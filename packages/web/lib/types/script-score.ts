/**
 * Script Score - Comprehensive screenplay analysis rubric
 *
 * Based on industry standards:
 * - Hollywood coverage reports
 * - The Black List evaluation criteria
 * - Save the Cat / Hero's Journey structural beats
 * - Commercial viability metrics
 */

// =============================================================================
// Score Categories
// =============================================================================

export type ScoreValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface CategoryScore {
  score: ScoreValue;
  confidence: number; // 0-1, how confident the analysis is
  summary: string; // 1-2 sentence summary
  strengths: string[]; // What works well
  weaknesses: string[]; // Areas for improvement
  suggestions: string[]; // Actionable recommendations
}

// =============================================================================
// Writing Quality Dimension
// =============================================================================

export interface WritingQualityScore {
  overall: CategoryScore;

  // Sub-dimensions
  dialogue: CategoryScore & {
    subtext_usage: ScoreValue; // Do characters say what they mean indirectly?
    voice_distinction: ScoreValue; // Can you tell characters apart by dialogue?
    naturalism: ScoreValue; // Does it sound like real speech?
    economy: ScoreValue; // Is every line necessary?
  };

  action_lines: CategoryScore & {
    clarity: ScoreValue; // Is the visual storytelling clear?
    brevity: ScoreValue; // Are descriptions tight?
    voice: ScoreValue; // Does the writer have a distinct style?
  };

  formatting: CategoryScore & {
    industry_standard: ScoreValue; // Proper screenplay format?
    white_space: ScoreValue; // Good page balance?
    readability: ScoreValue; // Easy to scan?
  };
}

// =============================================================================
// Story Quality Dimension
// =============================================================================

export interface StoryQualityScore {
  overall: CategoryScore;

  premise: CategoryScore & {
    originality: ScoreValue; // Fresh take or derivative?
    clarity: ScoreValue; // Can you explain it in one sentence?
    hook: ScoreValue; // Does it grab attention immediately?
  };

  structure: CategoryScore & {
    three_act: ScoreValue; // Clear beginning, middle, end?
    pacing: ScoreValue; // Does it move well?
    beat_sheet: ScoreValue; // Hits expected story beats?
    turning_points: ScoreValue; // Strong act breaks?
  };

  characters: CategoryScore & {
    protagonist_clarity: ScoreValue; // Clear main character with goal?
    antagonist_strength: ScoreValue; // Worthy opposition?
    arc: ScoreValue; // Does protagonist change?
    supporting_cast: ScoreValue; // Distinct, necessary characters?
    motivation: ScoreValue; // Clear wants and needs?
  };

  conflict: CategoryScore & {
    central_conflict: ScoreValue; // Clear main problem?
    stakes: ScoreValue; // What's at risk?
    escalation: ScoreValue; // Does tension build?
    resolution: ScoreValue; // Satisfying ending?
  };

  theme: CategoryScore & {
    presence: ScoreValue; // Is there a central theme?
    integration: ScoreValue; // Woven throughout or tacked on?
    resonance: ScoreValue; // Universal or niche?
  };
}

// =============================================================================
// Commercial Viability Dimension
// =============================================================================

export interface CommercialViabilityScore {
  overall: CategoryScore;

  market_fit: CategoryScore & {
    genre_clarity: ScoreValue; // Clear genre positioning?
    target_audience: ScoreValue; // Defined audience?
    trend_alignment: ScoreValue; // Fits current market?
    comparables: string[]; // Similar successful projects
  };

  producibility: CategoryScore & {
    budget_tier: 'micro' | 'low' | 'medium' | 'high' | 'blockbuster';
    location_feasibility: ScoreValue; // Can locations be achieved?
    cast_requirements: ScoreValue; // Star vehicle or ensemble?
    vfx_demands: ScoreValue; // Heavy VFX needs?
    period_setting: boolean; // Historical = more expensive
  };

  platform_fit: {
    theatrical: ScoreValue; // Big screen worthy?
    streaming: ScoreValue; // Binge-worthy?
    limited_series: ScoreValue; // Could expand to series?
    international: ScoreValue; // Global appeal?
  };

  sales_hooks: CategoryScore & {
    logline_strength: ScoreValue;
    poster_moment: boolean; // Iconic visual potential?
    trailer_beats: ScoreValue; // Good trailer material?
    word_of_mouth: ScoreValue; // Talkability factor?
  };
}

// =============================================================================
// Production Likelihood Dimension
// =============================================================================

export interface ProductionLikelihoodScore {
  overall: CategoryScore;

  execution_readiness: CategoryScore & {
    script_polish: ScoreValue; // Ready to shoot or needs work?
    coverage_ready: ScoreValue; // Would pass studio coverage?
    director_attachment: ScoreValue; // Director-friendly material?
  };

  industry_factors: CategoryScore & {
    diversity_inclusion: ScoreValue; // Diverse perspectives?
    cultural_relevance: ScoreValue; // Timely themes?
    controversy_risk: ScoreValue; // Brand-safe?
    awards_potential: ScoreValue; // Prestige project?
  };

  practical_considerations: {
    page_count: number;
    estimated_runtime_minutes: number;
    speaking_roles: number;
    locations_count: number;
    major_set_pieces: number;
  };
}

// =============================================================================
// Dialogue Quality Deep Dive
// =============================================================================

export interface DialogueAnalysis {
  overall: CategoryScore;

  // Per-character analysis
  characters: Array<{
    name: string;
    line_count: number;
    avg_line_length: number;
    vocabulary_richness: ScoreValue;
    speech_patterns: string[]; // Identified verbal tics, catchphrases
    emotional_range: ScoreValue;
    consistency: ScoreValue;
    memorable_lines: string[];
  }>;

  // Conversation dynamics
  dynamics: {
    conflict_in_dialogue: ScoreValue; // Characters want different things?
    power_shifts: ScoreValue; // Status changes in scenes?
    subtext_density: ScoreValue; // What's unsaid?
    exposition_handling: ScoreValue; // Natural info delivery?
  };

  // Technical dialogue issues
  issues: Array<{
    type: 'on_the_nose' | 'exposition_dump' | 'redundant' | 'anachronistic' | 'inconsistent_voice';
    location: string; // Scene/page reference
    example: string;
    suggestion: string;
  }>;
}

// =============================================================================
// Structural Analysis
// =============================================================================

export interface StructuralAnalysis {
  // Beat sheet analysis (Save the Cat structure)
  beat_sheet: {
    opening_image?: { page: number; description: string; score: ScoreValue };
    theme_stated?: { page: number; description: string; score: ScoreValue };
    setup?: { pages: [number, number]; description: string; score: ScoreValue };
    catalyst?: { page: number; description: string; score: ScoreValue };
    debate?: { pages: [number, number]; description: string; score: ScoreValue };
    break_into_two?: { page: number; description: string; score: ScoreValue };
    b_story?: { page: number; description: string; score: ScoreValue };
    fun_and_games?: { pages: [number, number]; description: string; score: ScoreValue };
    midpoint?: { page: number; description: string; score: ScoreValue };
    bad_guys_close_in?: { pages: [number, number]; description: string; score: ScoreValue };
    all_is_lost?: { page: number; description: string; score: ScoreValue };
    dark_night_of_soul?: { pages: [number, number]; description: string; score: ScoreValue };
    break_into_three?: { page: number; description: string; score: ScoreValue };
    finale?: { pages: [number, number]; description: string; score: ScoreValue };
    final_image?: { page: number; description: string; score: ScoreValue };
  };

  // Pacing analysis
  pacing: {
    scene_length_distribution: {
      short: number; // < 1 page
      medium: number; // 1-3 pages
      long: number; // > 3 pages
    };
    act_balance: {
      act_one_percent: number;
      act_two_percent: number;
      act_three_percent: number;
    };
    tension_curve: Array<{
      page: number;
      tension_level: number; // 0-10
    }>;
  };

  // Scene analysis
  scenes: Array<{
    scene_number: number;
    page_range: [number, number];
    location: string;
    characters_present: string[];
    purpose: 'exposition' | 'character' | 'plot' | 'action' | 'transition';
    conflict_present: boolean;
    advances_plot: boolean;
    could_cut: boolean;
    notes: string;
  }>;
}

// =============================================================================
// Comprehensive Script Score
// =============================================================================

export interface ScriptScore {
  // Metadata
  script_id: string;
  title: string;
  analyzed_at: string;
  page_count: number;
  genre: string[];
  logline: string;

  // Main scores (each 1-10)
  overall_score: ScoreValue;
  writing_quality: WritingQualityScore;
  story_quality: StoryQualityScore;
  commercial_viability: CommercialViabilityScore;
  production_likelihood: ProductionLikelihoodScore;
  dialogue_analysis: DialogueAnalysis;
  structural_analysis: StructuralAnalysis;

  // Industry-standard verdict
  coverage_verdict: 'pass' | 'consider' | 'consider_with_reservations' | 'recommend';

  // Executive summary
  executive_summary: {
    one_liner: string; // "A compelling thriller with sharp dialogue but pacing issues"
    top_strengths: string[];
    critical_weaknesses: string[];
    comparison_titles: string[];
    ideal_for: string[]; // "Streaming platforms seeking elevated genre content"
  };

  // Improvement roadmap
  improvement_roadmap: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    area: string;
    issue: string;
    recommendation: string;
    effort: 'quick_fix' | 'moderate_revision' | 'major_rewrite';
  }>;
}

// =============================================================================
// Analysis Request/Response
// =============================================================================

export interface ScriptScoreRequest {
  project_id: string;
  script_text: string;
  include_dialogue_deep_dive?: boolean;
  include_structural_analysis?: boolean;
  comparison_scripts?: string[]; // Optional scripts to compare against
}

export interface ScriptScoreProgress {
  phase: 'parsing' | 'writing_analysis' | 'story_analysis' | 'commercial_analysis' | 'dialogue_analysis' | 'structural_analysis' | 'synthesis';
  percent: number;
  current_task: string;
}
