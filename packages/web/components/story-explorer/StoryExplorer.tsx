'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { SceneNode } from './graph/scene-node';
import { CharacterNode } from './graph/character-node';
import { ExplorerEdge } from './graph/explorer-edge';
import {
  extractScenes,
  extractCharacters,
  computeCoOccurrence,
  buildSceneFlowNodes,
  buildCharacterNetworkNodes,
  type ExplorerScene,
  type ExplorerCharacter,
} from './graph/build-explorer-graph';
import { SceneDetailPanel } from './panels/scene-detail-panel';
import { CharacterDetailPanel } from './panels/character-detail-panel';
import { LegendPanel } from './panels/legend-panel';

const nodeTypes = {
  sceneNode: SceneNode,
  characterNode: CharacterNode,
};

const edgeTypes = {
  explorerEdge: ExplorerEdge,
};

type ViewMode = 'scene-flow' | 'character-network';

interface StoryExplorerProps {
  directorJson: unknown;
}

export function StoryExplorer({ directorJson }: StoryExplorerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('scene-flow');
  const [selectedScene, setSelectedScene] = useState<ExplorerScene | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<ExplorerCharacter | null>(null);

  const scenes = useMemo(() => extractScenes(directorJson), [directorJson]);
  const characters = useMemo(() => extractCharacters(directorJson), [directorJson]);
  const coOccurrences = useMemo(() => computeCoOccurrence(scenes), [scenes]);

  const sceneGraph = useMemo(() => buildSceneFlowNodes(scenes), [scenes]);
  const charGraph = useMemo(
    () => buildCharacterNetworkNodes(characters, coOccurrences),
    [characters, coOccurrences]
  );

  const activeGraph = viewMode === 'scene-flow' ? sceneGraph : charGraph;

  const [nodes, setNodes, onNodesChange] = useNodesState(activeGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(activeGraph.edges);

  // Sync nodes/edges when view mode changes
  const handleViewChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      setSelectedScene(null);
      setSelectedCharacter(null);
      const graph = mode === 'scene-flow' ? sceneGraph : charGraph;
      setNodes(graph.nodes);
      setEdges(graph.edges);
    },
    [sceneGraph, charGraph, setNodes, setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node: Node) => {
      if (viewMode === 'scene-flow') {
        const scene = scenes.find((s) => s.sceneId === node.id);
        setSelectedScene(scene ?? null);
        setSelectedCharacter(null);
      } else {
        const char = characters.find((c) => c.name === node.id);
        setSelectedCharacter(char ?? null);
        setSelectedScene(null);
      }
    },
    [viewMode, scenes, characters]
  );

  if (scenes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Generate audio first to explore your story graph.
      </div>
    );
  }

  return (
    <div className="relative h-[500px] border rounded-lg overflow-hidden bg-background">
      {/* View Mode Tabs */}
      <div className="absolute top-3 left-3 z-10 flex gap-1 bg-card/90 backdrop-blur border rounded-lg p-1">
        <button
          role="tab"
          aria-selected={viewMode === 'scene-flow'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'scene-flow'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleViewChange('scene-flow')}
        >
          Scene Flow
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'character-network'}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            viewMode === 'character-network'
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => handleViewChange('character-network')}
        >
          Character Network
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={3}
          pannable
          zoomable
          className="!bg-card/80 !border"
        />
      </ReactFlow>

      {viewMode === 'scene-flow' && <LegendPanel />}

      {selectedScene && (
        <SceneDetailPanel
          scene={selectedScene}
          onClose={() => setSelectedScene(null)}
        />
      )}

      {selectedCharacter && (
        <CharacterDetailPanel
          character={selectedCharacter}
          onClose={() => setSelectedCharacter(null)}
        />
      )}
    </div>
  );
}
