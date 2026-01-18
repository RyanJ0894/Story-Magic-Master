import { z } from 'zod';

// Word-level alignment from Whisper
export const WordAlignmentSchema = z.object({
  w: z.string(),
  s: z.number(), // start time
  e: z.number(), // end time
});

export type WordAlignment = z.infer<typeof WordAlignmentSchema>;

// Line-level alignment
export const LineAlignmentSchema = z.object({
  line_id: z.string(),
  start: z.number(),
  end: z.number(),
  words: z.array(WordAlignmentSchema).optional(),
});

export type LineAlignment = z.infer<typeof LineAlignmentSchema>;

// Scene alignment
export const AlignmentSchema = z.object({
  scene_id: z.string(),
  lines: z.array(LineAlignmentSchema),
});

export type Alignment = z.infer<typeof AlignmentSchema>;

// Timeline event types
export const DialogueInEventSchema = z.object({
  type: z.literal('dialogue_in'),
  line_id: z.string(),
  at: z.number(),
});

export const DialogueOutEventSchema = z.object({
  type: z.literal('dialogue_out'),
  line_id: z.string(),
  at: z.number(),
});

export const AmbienceInEventSchema = z.object({
  type: z.literal('ambience_in'),
  cue_id: z.string(),
  at: z.number(),
  fade: z.number().default(1.5),
  gain_db: z.number().default(-18),
});

export const AmbienceOutEventSchema = z.object({
  type: z.literal('ambience_out'),
  cue_id: z.string(),
  at: z.number(),
  fade: z.number().default(1.5),
});

export const MusicInEventSchema = z.object({
  type: z.literal('music_in'),
  cue_id: z.string(),
  at: z.number(),
  fade: z.number().default(1),
  gain_db: z.number().default(-12),
  duck_db: z.number().default(7),
});

export const MusicOutEventSchema = z.object({
  type: z.literal('music_out'),
  cue_id: z.string(),
  at: z.number(),
  fade: z.number().default(2),
});

export const SfxAtEventSchema = z.object({
  type: z.literal('sfx_at'),
  cue_id: z.string(),
  at: z.number(),
  gain_db: z.number().default(-6),
  duration: z.number().optional(),
});

// Union of all timeline events
export const TimelineEventSchema = z.discriminatedUnion('type', [
  DialogueInEventSchema,
  DialogueOutEventSchema,
  AmbienceInEventSchema,
  AmbienceOutEventSchema,
  MusicInEventSchema,
  MusicOutEventSchema,
  SfxAtEventSchema,
]);

export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// Full timeline for a scene
export const TimelineSchema = z.object({
  scene_id: z.string(),
  events: z.array(TimelineEventSchema),
});

export type Timeline = z.infer<typeof TimelineSchema>;

// Mix manifest - metadata about the final mix
export const MixManifestSchema = z.object({
  scene_id: z.string(),
  inputs: z.object({
    dialogue: z.array(z.object({
      line_id: z.string(),
      path: z.string(),
    })),
    music: z.array(z.object({
      cue_id: z.string(),
      path: z.string(),
      gain_db: z.number(),
    })),
    ambience: z.array(z.object({
      cue_id: z.string(),
      path: z.string(),
      gain_db: z.number(),
    })),
    sfx: z.array(z.object({
      cue_id: z.string(),
      path: z.string(),
      gain_db: z.number(),
    })).optional(),
  }),
  lufs_i: z.number().optional(),
  true_peak_db: z.number().optional(),
  filters: z.array(z.string()),
});

export type MixManifest = z.infer<typeof MixManifestSchema>;

// Playback manifest for the complete episode
export const PlaybackManifestSchema = z.object({
  project_id: z.string(),
  order: z.array(z.object({
    scene_id: z.string(),
    offset: z.number(),
    duration: z.number(),
    lines: z.array(z.object({
      line_id: z.string(),
      start: z.number(),
      end: z.number(),
    })).optional(),
  })),
  total: z.number(),
  public_url: z.string().optional(),
});

export type PlaybackManifest = z.infer<typeof PlaybackManifestSchema>;
