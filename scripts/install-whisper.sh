#!/usr/bin/env bash
#
# Install whisper.cpp + the base.en model for orchestrator alignment.
#
# Designed to run as part of the Render buildCommand. Idempotent and cache-
# friendly: the compiled binary lives in the project src directory (re-built
# each deploy, ~30s) and the model lives on the persistent disk (downloaded
# once, then reused across deploys).
#
# Outputs (exported via the env vars below — set them in Doppler `prd`):
#   WHISPER_CPP_PATH     /opt/render/project/src/bin/whisper
#   WHISPER_MODEL_PATH   /var/data/audio/.whisper-models/ggml-base.en.bin
#
# Fail-soft: if any step fails, we print a warning and exit 0 so the
# overall Render build still succeeds. Whisper is a quality enhancement,
# not a correctness requirement — the Groq Whisper fallback (PR #231)
# keeps alignment working.

set -uo pipefail

readonly WHISPER_VERSION="${WHISPER_VERSION:-v1.7.4}"
readonly WHISPER_REPO="https://github.com/ggerganov/whisper.cpp.git"
readonly MODEL_NAME="ggml-base.en.bin"
# Primary: a known-good Cloudflare R2 mirror we control. Render's egress IPs
# get throttled / 403'd by HuggingFace's Cloudflare during cold builds — every
# attempt at downloading from HF directly has failed (see 2026-06-13 incident
# logs). R2 is in the same Cloudflare network, has free egress, no rate limits
# at our scale, and serves from our existing servicevision-files bucket.
# Override via Doppler env if we ever need to switch back to HF or another
# mirror without a code change.
readonly MODEL_URL_PRIMARY="${WHISPER_MODEL_URL:-https://pub-0466dbb0cd8d46adb26ceada87d64eb9.r2.dev/whisper/${MODEL_NAME}}"
# Fallback: upstream HuggingFace. Tried second; documented as flaky on Render.
readonly MODEL_URL_FALLBACK="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_NAME}"
# Pin updated 2026-06-14 — HF's ggerganov/whisper.cpp updated the base.en file
# between deployments; the prior c78c86… hash no longer matches. The R2 mirror
# is the same bytes we verified at upload time.
readonly MODEL_SHA256="${WHISPER_MODEL_SHA256:-a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002}"
readonly EXPECTED_SHA256="${MODEL_SHA256}"

# Paths — pinned to Render's project layout.
#
# Both binary and model live under PROJECT_ROOT (= /opt/render/project/src
# at runtime). The 2026-06-14 deploy proved that Render does NOT make the
# /var/data persistent disk writable during the build stage: the model
# download succeeded HTTP-wise (R2 returned 200, transfer started) but
# curl exit 23 'Failure writing output to destination' fired on the first
# buffered write. Same path is writable during runtime — but install-
# whisper.sh runs at build time, so it has to live somewhere that's
# writable at that stage.
#
# Putting the model alongside the binary in the ephemeral project dir
# means we re-download (~5 s from R2 via Cloudflare's network) on every
# deploy, but it actually works. R2 egress is free in our R2 tier and our
# deploy cadence is low single-digits per day, so the cost is rounding
# error.
readonly PROJECT_ROOT="${PROJECT_ROOT:-/opt/render/project/src}"
readonly BIN_DIR="${PROJECT_ROOT}/bin"
readonly BIN_PATH="${BIN_DIR}/whisper"
readonly MODEL_DIR="${WHISPER_MODEL_DIR:-${PROJECT_ROOT}/.whisper-models}"
readonly MODEL_PATH="${MODEL_DIR}/${MODEL_NAME}"
readonly BUILD_DIR="/tmp/whisper-build"

log() { printf '[install-whisper] %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# 1. Binary: clone + build whisper.cpp
# ---------------------------------------------------------------------------
install_binary() {
  if [[ -x "${BIN_PATH}" ]]; then
    log "binary already present at ${BIN_PATH} — skipping build"
    return 0
  fi

  log "building whisper.cpp ${WHISPER_VERSION} → ${BIN_PATH}"
  rm -rf "${BUILD_DIR}"

  if ! git clone --depth 1 --branch "${WHISPER_VERSION}" "${WHISPER_REPO}" "${BUILD_DIR}" >/dev/null 2>&1; then
    log "WARN: git clone of whisper.cpp ${WHISPER_VERSION} failed — alignment will use Groq fallback"
    return 1
  fi

  # Build with cmake (newer whisper.cpp releases use cmake; older still ship
  # a Makefile). Try both, prefer cmake if available.
  #
  # CRITICAL: -DBUILD_SHARED_LIBS=OFF forces the binary to be statically
  # linked against libwhisper / libggml. Without this, cmake builds a binary
  # that dynamically loads libwhisper.so.1 from build/src, which isn't
  # present at runtime when only the binary is copied to BIN_PATH. The
  # 2026-06-13 incident: build appeared to succeed, but `whisper --help`
  # printed "error while loading shared libraries: libwhisper.so.1" and
  # alignment silently fell through to Groq for 24 h before we noticed.
  (
    cd "${BUILD_DIR}" || exit 1
    if command -v cmake >/dev/null 2>&1 && [[ -f CMakeLists.txt ]]; then
      cmake -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_SHARED_LIBS=OFF \
        -DWHISPER_BUILD_TESTS=OFF \
        -DWHISPER_BUILD_EXAMPLES=ON \
        >/dev/null 2>&1
      cmake --build build --config Release -j 2 >/dev/null 2>&1 || true
      # Newer cmake builds produce ./build/bin/main or whisper-cli
      for cand in build/bin/whisper-cli build/bin/main build/bin/whisper; do
        if [[ -x "${cand}" ]]; then
          mkdir -p "${BIN_DIR}"
          cp "${cand}" "${BIN_PATH}"
          break
        fi
      done
    else
      make -j 2 >/dev/null 2>&1 || true
      if [[ -x ./main ]]; then
        mkdir -p "${BIN_DIR}"
        cp ./main "${BIN_PATH}"
      fi
    fi
  )

  rm -rf "${BUILD_DIR}"

  if [[ ! -x "${BIN_PATH}" ]]; then
    log "WARN: whisper.cpp build did not produce a binary — alignment will use Groq fallback"
    return 1
  fi

  # Verify the binary actually runs. If it was built dynamically and the
  # shared libs aren't found, this fails — and we treat that as a build
  # failure, NOT a successful install. Without this, BIN_PATH exists +
  # is executable, but every alignment call would hit a shared-library
  # error and fall through to Groq.
  local help_out
  if ! help_out=$("${BIN_PATH}" --help 2>&1); then
    log "WARN: whisper binary failed to execute — likely missing shared libs (${help_out:0:200})"
    rm -f "${BIN_PATH}"
    return 1
  fi
  log "binary installed: $(echo "${help_out}" | head -1)"
}

# ---------------------------------------------------------------------------
# 2. Model: download to the persistent disk (one-time cost across deploys)
# ---------------------------------------------------------------------------
install_model() {
  if [[ -f "${MODEL_PATH}" ]]; then
    local actual_size
    actual_size=$(stat -c %s "${MODEL_PATH}" 2>/dev/null || stat -f %z "${MODEL_PATH}" 2>/dev/null || echo 0)
    # The base.en model is ~142 MB. If it's smaller, it's probably a truncated
    # download from a previous failed run — re-fetch.
    if [[ "${actual_size}" -gt 100000000 ]]; then
      log "model already present at ${MODEL_PATH} (${actual_size} bytes) — skipping download"
      return 0
    fi
    log "model file at ${MODEL_PATH} looks truncated (${actual_size} bytes) — re-downloading"
    rm -f "${MODEL_PATH}"
  fi

  log "downloading ${MODEL_NAME} (~142 MB) → ${MODEL_PATH}"
  mkdir -p "${MODEL_DIR}"

  # Verify the target directory is actually writable. Without this, curl
  # logs the misleading 'Failure writing output to destination' AFTER the
  # whole download attempts. Catching it here makes the failure mode
  # explicit: 'destination not writable' vs 'network error'.
  if ! touch "${MODEL_DIR}/.write-test" 2>/dev/null; then
    log "WARN: ${MODEL_DIR} is not writable at build time — alignment will use Groq fallback"
    return 1
  fi
  rm -f "${MODEL_DIR}/.write-test"

  # Try the R2 mirror first, fall back to HuggingFace if R2 has an outage.
  # -fsSL = fail-on-error, silent (no progress meter!), show-error, follow-redirects.
  # The previous -fSL included curl's progress bar in stderr, which the 300-char
  # slice below truncated to '% Total % Received...' — hiding the actual error.
  # -fsSL means stderr contains ONLY the failure reason when one occurs.
  # -w writes the final HTTP code + effective URL on success/failure so we can
  # tell apart a 403 from a TLS timeout from a connection reset.
  local curl_err='' curl_meta='' src
  local fetched=0
  for src in "${MODEL_URL_PRIMARY}" "${MODEL_URL_FALLBACK}"; do
    log "fetching model from: ${src}"
    # Run in a subshell so we can capture stdout (-w writes there) + stderr.
    if curl_meta=$(curl -fsSL --retry 3 --retry-all-errors \
                       --connect-timeout 30 --max-time 600 \
                       -A "story-magic-orchestrator/2.0" \
                       -o "${MODEL_PATH}.tmp" \
                       -w 'HTTP=%{http_code} URL=%{url_effective} TIME=%{time_total}s SIZE=%{size_download}' \
                       "${src}" 2>/tmp/curl-err.log); then
      fetched=1
      log "  ok — ${curl_meta}"
      break
    fi
    local exit_code=$?
    curl_err=$(< /tmp/curl-err.log)
    log "  failed: exit=${exit_code} meta='${curl_meta}' stderr='${curl_err}'"
    rm -f "${MODEL_PATH}.tmp"
  done

  if [[ "${fetched}" -ne 1 ]]; then
    log "WARN: model download failed from both R2 and HF — alignment will use Groq fallback"
    return 1
  fi
  log "model download succeeded ($(stat -c %s "${MODEL_PATH}.tmp" 2>/dev/null || stat -f %z "${MODEL_PATH}.tmp" 2>/dev/null || echo '?') bytes)"

  # Verify checksum when MODEL_SHA256 is set. Fail closed on mismatch — a
  # download that doesn't match the expected hash is either corrupt or
  # tampered with, and we refuse to install it. (When MODEL_SHA256 is unset
  # the check is skipped — Groq fallback still covers the alignment path.)
  if [[ -n "${EXPECTED_SHA256}" ]]; then
    if ! command -v sha256sum >/dev/null 2>&1; then
      log "ERROR: MODEL_SHA256 is set but sha256sum is not on PATH — refusing to install unverified model"
      rm -f "${MODEL_PATH}.tmp"
      return 1
    fi
    if ! echo "${EXPECTED_SHA256}  ${MODEL_PATH}.tmp" | sha256sum -c - >/dev/null 2>&1; then
      log "ERROR: model checksum mismatch — refusing to install. Expected ${EXPECTED_SHA256}"
      rm -f "${MODEL_PATH}.tmp"
      return 1
    fi
    log "model checksum verified"
  fi

  mv "${MODEL_PATH}.tmp" "${MODEL_PATH}"
  log "model installed: ${MODEL_PATH}"
}

# ---------------------------------------------------------------------------
# main — fail-soft
# ---------------------------------------------------------------------------
install_binary || log "WARN: binary install failed — continuing"
install_model  || log "WARN: model install failed — continuing"

if [[ -x "${BIN_PATH}" ]] && [[ -f "${MODEL_PATH}" ]]; then
  log "OK: whisper.cpp is ready. Set WHISPER_CPP_PATH=${BIN_PATH} and WHISPER_MODEL_PATH=${MODEL_PATH} in Doppler."
else
  log "DEGRADED: whisper.cpp not fully installed. Orchestrator will use Groq Whisper fallback (PR #231)."
fi

# Always exit 0 — alignment via Groq is an acceptable fallback.
exit 0
