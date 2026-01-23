'use client';

/**
 * ScoreTrajectoryChart Component
 *
 * Visualizes score progression across revisions using Recharts.
 */

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { ScoreTrajectory } from '@/lib/revisions/types';

// =============================================================================
// Props
// =============================================================================

interface ScoreTrajectoryChartProps {
  trajectory: ScoreTrajectory;
  height?: number;
  showCard?: boolean;
  className?: string;
}

// =============================================================================
// Custom Tooltip
// =============================================================================

interface TooltipPayload {
  value: number;
  payload: {
    versionNumber: number;
    score: number;
    date: string;
    formattedDate: string;
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 min-w-[140px]">
      <p className="text-xs text-muted-foreground mb-1">{data.formattedDate}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Version {data.versionNumber}</span>
        <span
          className={`text-lg font-bold ${
            data.score >= 80
              ? 'text-green-600 dark:text-green-400'
              : data.score >= 60
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {data.score}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function ScoreTrajectoryChart({
  trajectory,
  height = 200,
  showCard = true,
  className = '',
}: ScoreTrajectoryChartProps) {
  // Transform data for chart
  const chartData = useMemo(() => {
    return trajectory.dataPoints.map((point) => ({
      ...point,
      formattedDate: new Date(point.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [trajectory.dataPoints]);

  // Calculate stats
  const stats = useMemo(() => {
    const scores = trajectory.dataPoints.map((p) => p.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const current = scores[scores.length - 1];
    const first = scores[0];
    const totalChange = current - first;

    return { min, max, current, first, totalChange };
  }, [trajectory.dataPoints]);

  // Get trend icon and color
  const getTrendDisplay = () => {
    switch (trajectory.trend) {
      case 'improving':
        return {
          icon: <TrendingUp className="w-4 h-4" />,
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-100 dark:bg-green-900/30',
          label: 'Improving',
        };
      case 'declining':
        return {
          icon: <TrendingDown className="w-4 h-4" />,
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-100 dark:bg-red-900/30',
          label: 'Declining',
        };
      case 'stable':
        return {
          icon: <Minus className="w-4 h-4" />,
          color: 'text-slate-600 dark:text-slate-400',
          bg: 'bg-slate-100 dark:bg-slate-800',
          label: 'Stable',
        };
      default:
        return {
          icon: <Activity className="w-4 h-4" />,
          color: 'text-slate-500',
          bg: 'bg-slate-100 dark:bg-slate-800',
          label: 'Insufficient Data',
        };
    }
  };

  const trendDisplay = getTrendDisplay();

  // Determine Y-axis domain with padding
  const yMin = Math.max(0, stats.min - 10);
  const yMax = Math.min(100, stats.max + 10);

  // Chart content
  const chartContent = (
    <div className={`w-full ${className}`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-700"
            vertical={false}
          />

          <XAxis
            dataKey="formattedDate"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-slate-500"
          />

          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="text-slate-500"
            width={40}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Reference lines for score thresholds */}
          <ReferenceLine
            y={80}
            stroke="#22c55e"
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={60}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          />

          {/* Area fill under the line */}
          <Area
            type="monotone"
            dataKey="score"
            fill="url(#scoreGradient)"
            stroke="none"
          />

          {/* Main score line */}
          <Line
            type="monotone"
            dataKey="score"
            stroke="#8b5cf6"
            strokeWidth={2.5}
            dot={{
              fill: '#8b5cf6',
              stroke: '#fff',
              strokeWidth: 2,
              r: 4,
            }}
            activeDot={{
              fill: '#8b5cf6',
              stroke: '#fff',
              strokeWidth: 2,
              r: 6,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  // Return with or without card wrapper
  if (!showCard) {
    return chartContent;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-violet-500" />
              Score Trajectory
            </CardTitle>
            <CardDescription className="mt-1">
              Track how your script score evolves across revisions
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={`${trendDisplay.bg} ${trendDisplay.color} flex items-center gap-1`}
          >
            {trendDisplay.icon}
            {trendDisplay.label}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Current:</span>
            <span
              className={`font-semibold ${
                stats.current >= 80
                  ? 'text-green-600 dark:text-green-400'
                  : stats.current >= 60
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {stats.current}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Change:</span>
            <span
              className={`font-semibold ${
                stats.totalChange > 0
                  ? 'text-green-600 dark:text-green-400'
                  : stats.totalChange < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500'
              }`}
            >
              {stats.totalChange > 0 ? '+' : ''}
              {stats.totalChange}
            </span>
          </div>
          {trajectory.averageImprovement !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Avg/revision:</span>
              <span className="font-semibold">
                {trajectory.averageImprovement > 0 ? '+' : ''}
                {trajectory.averageImprovement.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-2">{chartContent}</CardContent>
    </Card>
  );
}

export default ScoreTrajectoryChart;
