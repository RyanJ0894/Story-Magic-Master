'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Play,
  Pause,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  User,
  Music,
  Volume2,
  Zap,
  GitBranch,
  Clock,
  Layers,
} from 'lucide-react';
import type { StoryGraph, StoryNode, ParallelGroup, StoryNodeStatus } from '@/lib/types/voice';

interface StorygraphProps {
  projectId: string;
  directorJson?: {
    scenes?: Array<{
      scene_id: string;
      dialogue?: Array<{
        line_id: string;
        character: string;
        text: string;
        voice_key?: string;
      }>;
      music?: { track_key: string; cue: string };
      ambience?: { track_key: string };
      sfx?: Array<{ track_key: string; trigger: string }>;
    }>;
  };
  jobProgress?: {
    step: string;
    percent: number;
    details?: string;
  };
}

// =============================================================================
// Storygraph Builder
// =============================================================================
function buildStorygraph(directorJson: StorygraphProps['directorJson']): StoryGraph | null {
  if (!directorJson?.scenes) return null;

  const nodes: StoryNode[] = [];
  const parallelGroups: ParallelGroup[] = [];
  let nodeSequence = 0;

  directorJson.scenes.forEach((scene, sceneIdx) => {
    const sceneNodes: string[] = [];

    // Add scene break node
    const sceneBreakId = `scene-${scene.scene_id}-break`;
    nodes.push({
      id: sceneBreakId,
      type: 'scene_break',
      scene_id: scene.scene_id,
      sequence: nodeSequence++,
      status: 'pending',
      dependencies: sceneIdx > 0 ? [`scene-${directorJson.scenes![sceneIdx - 1].scene_id}-end`] : [],
    });

    // Add ambience node (can process in parallel with dialogue)
    if (scene.ambience) {
      const ambienceId = `scene-${scene.scene_id}-ambience`;
      nodes.push({
        id: ambienceId,
        type: 'ambience',
        scene_id: scene.scene_id,
        sequence: nodeSequence++,
        audio_file: scene.ambience.track_key,
        cue_type: 'in',
        status: 'pending',
        dependencies: [sceneBreakId],
      });
      sceneNodes.push(ambienceId);
    }

    // Add music node (can process in parallel with dialogue)
    if (scene.music) {
      const musicId = `scene-${scene.scene_id}-music`;
      nodes.push({
        id: musicId,
        type: 'music',
        scene_id: scene.scene_id,
        sequence: nodeSequence++,
        audio_file: scene.music.track_key,
        cue_type: scene.music.cue === 'fade_in' ? 'in' : 'crossfade',
        status: 'pending',
        dependencies: [sceneBreakId],
      });
      sceneNodes.push(musicId);
    }

    // Add dialogue nodes
    scene.dialogue?.forEach((line, lineIdx) => {
      const dialogueId = `scene-${scene.scene_id}-line-${line.line_id}`;
      const prevLineId =
        lineIdx > 0
          ? `scene-${scene.scene_id}-line-${scene.dialogue![lineIdx - 1].line_id}`
          : sceneBreakId;

      nodes.push({
        id: dialogueId,
        type: 'dialogue',
        scene_id: scene.scene_id,
        sequence: nodeSequence++,
        character: line.character,
        voice_id: line.voice_key,
        text: line.text,
        status: 'pending',
        // Dialogue lines within a scene are sequential
        dependencies: [prevLineId],
      });
      sceneNodes.push(dialogueId);
    });

    // Add SFX nodes (can process in parallel)
    scene.sfx?.forEach((sfx, sfxIdx) => {
      const sfxId = `scene-${scene.scene_id}-sfx-${sfxIdx}`;
      nodes.push({
        id: sfxId,
        type: 'sfx',
        scene_id: scene.scene_id,
        sequence: nodeSequence++,
        audio_file: sfx.track_key,
        text: sfx.trigger,
        status: 'pending',
        dependencies: [sceneBreakId],
      });
      sceneNodes.push(sfxId);
    });

    // Add scene end marker
    const sceneEndId = `scene-${scene.scene_id}-end`;
    nodes.push({
      id: sceneEndId,
      type: 'scene_break',
      scene_id: scene.scene_id,
      sequence: nodeSequence++,
      status: 'pending',
      dependencies: sceneNodes.length > 0 ? sceneNodes : [sceneBreakId],
    });

    // Create parallel group for this scene's independent nodes
    // (music, ambience, sfx can all process in parallel)
    const parallelNodes = sceneNodes.filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node && ['music', 'ambience', 'sfx'].includes(node.type);
    });

    if (parallelNodes.length > 1) {
      parallelGroups.push({
        id: `parallel-${scene.scene_id}`,
        node_ids: parallelNodes,
        scene_id: scene.scene_id,
        status: 'pending',
      });
    }
  });

  return {
    project_id: '',
    version: 1,
    created_at: new Date().toISOString(),
    nodes,
    edges: [],
    parallel_groups: parallelGroups,
    critical_path: [],
    total_nodes: nodes.length,
    completed_nodes: 0,
    failed_nodes: 0,
    estimated_duration_ms: nodes.filter((n) => n.type === 'dialogue').length * 3000,
  };
}

// =============================================================================
// Node Status Icon
// =============================================================================
function NodeStatusIcon({ status }: { status: StoryNodeStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'queued':
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

// =============================================================================
// Node Type Icon
// =============================================================================
function NodeTypeIcon({ type }: { type: StoryNode['type'] }) {
  switch (type) {
    case 'dialogue':
      return <User className="h-3 w-3" />;
    case 'music':
      return <Music className="h-3 w-3" />;
    case 'ambience':
      return <Volume2 className="h-3 w-3" />;
    case 'sfx':
      return <Zap className="h-3 w-3" />;
    default:
      return null;
  }
}

// =============================================================================
// Scene Timeline Component
// =============================================================================
function SceneTimeline({
  sceneId,
  nodes,
  isExpanded,
  onToggle,
}: {
  sceneId: string;
  nodes: StoryNode[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const dialogueNodes = nodes.filter((n) => n.type === 'dialogue');
  const audioNodes = nodes.filter((n) => ['music', 'ambience', 'sfx'].includes(n.type));

  const completedCount = nodes.filter((n) => n.status === 'completed').length;
  const progress = nodes.length > 0 ? (completedCount / nodes.length) * 100 : 0;

  // Get unique characters in this scene
  const characters = Array.from(new Set(dialogueNodes.map((n) => n.character).filter(Boolean)));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {sceneId}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {dialogueNodes.length} lines • {characters.length} characters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Progress value={progress} className="w-20 h-2" />
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-2">
          {/* Parallel audio tracks */}
          {audioNodes.length > 0 && (
            <div className="mb-3 p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-1 mb-2">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Parallel tracks</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {audioNodes.map((node) => (
                  <TooltipProvider key={node.id}>
                    <Tooltip>
                      <TooltipTrigger>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            node.status === 'completed'
                              ? 'bg-green-500/20 text-green-700'
                              : node.status === 'processing'
                              ? 'bg-blue-500/20 text-blue-700'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <NodeTypeIcon type={node.type} />
                          <span>{node.type}</span>
                          <NodeStatusIcon status={node.status} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{node.audio_file || node.type}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

          {/* Dialogue timeline */}
          <div className="space-y-1">
            {dialogueNodes.map((node, idx) => (
              <div
                key={node.id}
                className={`flex items-start gap-2 p-2 rounded transition-colors ${
                  node.status === 'completed'
                    ? 'bg-green-500/10'
                    : node.status === 'processing'
                    ? 'bg-blue-500/10'
                    : node.status === 'failed'
                    ? 'bg-red-500/10'
                    : ''
                }`}
              >
                {/* Connection line */}
                <div className="flex flex-col items-center pt-1">
                  <NodeStatusIcon status={node.status} />
                  {idx < dialogueNodes.length - 1 && (
                    <div className="w-px h-full bg-border mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{node.character}</span>
                    {node.duration_ms && (
                      <span className="text-xs text-muted-foreground">
                        {(node.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{node.text}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// =============================================================================
// Main Storygraph Component
// =============================================================================
export function Storygraph({ projectId, directorJson, jobProgress }: StorygraphProps) {
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());

  const storygraph = useMemo(() => buildStorygraph(directorJson), [directorJson]);

  // Update node statuses based on job progress
  const updatedGraph = useMemo(() => {
    if (!storygraph || !jobProgress) return storygraph;

    const graph = { ...storygraph, nodes: [...storygraph.nodes] };

    // Simulate progress through nodes based on job progress
    const progressPercent = jobProgress.percent;
    const totalDialogue = graph.nodes.filter((n) => n.type === 'dialogue').length;
    const completedCount = Math.floor((progressPercent / 100) * totalDialogue);

    let dialogueIdx = 0;
    graph.nodes = graph.nodes.map((node) => {
      if (node.type === 'dialogue') {
        if (dialogueIdx < completedCount) {
          dialogueIdx++;
          return { ...node, status: 'completed' as StoryNodeStatus };
        } else if (dialogueIdx === completedCount && jobProgress.step === 'generating_audio') {
          dialogueIdx++;
          return { ...node, status: 'processing' as StoryNodeStatus };
        }
        dialogueIdx++;
      }
      return node;
    });

    graph.completed_nodes = graph.nodes.filter((n) => n.status === 'completed').length;

    return graph;
  }, [storygraph, jobProgress]);

  if (!directorJson?.scenes) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Generate audio to see the storygraph visualization.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!updatedGraph) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Unable to build storygraph from director data.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group nodes by scene
  const sceneGroups = new Map<string, StoryNode[]>();
  updatedGraph.nodes.forEach((node) => {
    if (!sceneGroups.has(node.scene_id)) {
      sceneGroups.set(node.scene_id, []);
    }
    sceneGroups.get(node.scene_id)!.push(node);
  });

  const toggleScene = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedScenes(new Set(sceneGroups.keys()));
  };

  const collapseAll = () => {
    setExpandedScenes(new Set());
  };

  const totalDialogue = updatedGraph.nodes.filter((n) => n.type === 'dialogue').length;
  const completedDialogue = updatedGraph.nodes.filter(
    (n) => n.type === 'dialogue' && n.status === 'completed'
  ).length;
  const parallelTracks = updatedGraph.parallel_groups.length;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Storygraph
          </h3>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <span>{sceneGroups.size} scenes</span>
            <span>•</span>
            <span>{totalDialogue} lines</span>
            {parallelTracks > 0 && (
              <>
                <span>•</span>
                <span>{parallelTracks} parallel groups</span>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Overall progress */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Progress</span>
                <span>
                  {completedDialogue} / {totalDialogue} lines
                </span>
              </div>
              <Progress
                value={totalDialogue > 0 ? (completedDialogue / totalDialogue) * 100 : 0}
                className="h-2"
              />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                {totalDialogue > 0 ? Math.round((completedDialogue / totalDialogue) * 100) : 0}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scene timelines */}
      <div className="space-y-3">
        {Array.from(sceneGroups.entries()).map(([sceneId, nodes]) => (
          <SceneTimeline
            key={sceneId}
            sceneId={sceneId}
            nodes={nodes.filter((n) => n.type !== 'scene_break')}
            isExpanded={expandedScenes.has(sceneId)}
            onToggle={() => toggleScene(sceneId)}
          />
        ))}
      </div>
    </div>
  );
}
