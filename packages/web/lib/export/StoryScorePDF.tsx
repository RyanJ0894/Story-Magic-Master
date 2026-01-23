/**
 * StoryScore PDF Template
 *
 * Generates a professional PDF report of a StoryScore analysis.
 * Uses @react-pdf/renderer for PDF generation.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { StoryScore, DIMENSIONS, RATINGS, DimensionKey } from '@/lib/scoring/types';

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1e293b',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #6366f1',
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  overallScore: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  scoreExcellent: {
    color: '#22c55e',
  },
  scoreGood: {
    color: '#84cc16',
  },
  scoreFair: {
    color: '#f59e0b',
  },
  scorePoor: {
    color: '#ef4444',
  },
  verdict: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#475569',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 20,
    marginBottom: 15,
    paddingBottom: 8,
    borderBottom: '1px solid #e2e8f0',
  },
  dimensionGroup: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6366f1',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  dimension: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 4,
  },
  dimensionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dimensionName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  dimensionScore: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dimensionSummary: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.5,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  highlightsSection: {
    marginTop: 20,
  },
  highlight: {
    marginBottom: 8,
    paddingLeft: 12,
    borderLeft: '3px solid',
  },
  highlightStrength: {
    borderLeftColor: '#22c55e',
  },
  highlightWeakness: {
    borderLeftColor: '#ef4444',
  },
  highlightText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 9,
    color: '#94a3b8',
  },
});

// =============================================================================
// Helper Functions
// =============================================================================

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 65) return '#84cc16';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function getScoreStyle(score: number) {
  if (score >= 80) return styles.scoreExcellent;
  if (score >= 65) return styles.scoreGood;
  if (score >= 50) return styles.scoreFair;
  return styles.scorePoor;
}

// =============================================================================
// Props
// =============================================================================

interface StoryScorePDFProps {
  score: StoryScore;
  projectName: string;
  generatedAt?: Date;
}

// =============================================================================
// PDF Document Component
// =============================================================================

export function StoryScorePDF({
  score,
  projectName,
  generatedAt = new Date(),
}: StoryScorePDFProps) {
  // Group dimensions by category
  const dimensionGroups = {
    concept: ['premiseOriginality', 'loglineClarity', 'commercialViability'],
    structure: ['threeActIntegrity', 'pacingMomentum', 'stakesEscalation'],
    character: ['protagonistArc', 'supportingCast', 'castability'],
    craft: ['dialogueQuality', 'visualStorytelling', 'technicalExecution'],
  };

  const groupLabels = {
    concept: 'Concept & Marketability',
    structure: 'Structure & Pacing',
    character: 'Character & Casting',
    craft: 'Craft & Execution',
  };

  // Get strengths and weaknesses
  const sortedDimensions = Object.entries(score.dimensions).sort(
    ([, a], [, b]) => b.score - a.score
  );
  const strengths = sortedDimensions.slice(0, 3);
  const weaknesses = sortedDimensions.slice(-3).reverse();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>StoryScore Report</Text>
          <Text style={styles.subtitle}>{projectName}</Text>
        </View>

        {/* Overall Score */}
        <View style={styles.overallScore}>
          <View>
            <Text style={styles.scoreLabel}>Overall Score</Text>
            <Text style={styles.verdict}>{RATINGS[score.rating].label}</Text>
          </View>
          <Text style={[styles.scoreValue, getScoreStyle(score.overallScore)]}>
            {Math.round(score.overallScore)}
          </Text>
        </View>

        {/* Dimension Scores */}
        <Text style={styles.sectionTitle}>Detailed Analysis</Text>

        {Object.entries(dimensionGroups).map(([group, dimensionKeys]) => (
          <View key={group} style={styles.dimensionGroup}>
            <Text style={styles.groupTitle}>
              {groupLabels[group as keyof typeof groupLabels]}
            </Text>

            {dimensionKeys.map((key) => {
              const dimension = score.dimensions[key as keyof typeof score.dimensions];
              if (!dimension) return null;

              const config = DIMENSIONS[key as DimensionKey];

              return (
                <View key={key} style={styles.dimension}>
                  <View style={styles.dimensionHeader}>
                    <Text style={styles.dimensionName}>{config.label}</Text>
                    <Text
                      style={[
                        styles.dimensionScore,
                        { color: getScoreColor(dimension.score) },
                      ]}
                    >
                      {Math.round(dimension.score)}/100
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${dimension.score}%`,
                          backgroundColor: getScoreColor(dimension.score),
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.dimensionSummary}>{dimension.reasoning}</Text>
                </View>
              );
            })}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Story Magic - StoryScore Report</Text>
          <Text>Generated {generatedAt.toLocaleDateString()}</Text>
        </View>
      </Page>

      {/* Page 2: Strengths & Weaknesses */}
      <Page size="A4" style={styles.page}>
        <View style={styles.highlightsSection}>
          <Text style={styles.sectionTitle}>Key Strengths</Text>
          {strengths.map(([key, dimension]) => {
            const config = DIMENSIONS[key as DimensionKey];
            return (
              <View key={key} style={[styles.highlight, styles.highlightStrength]}>
                <Text style={styles.dimensionName}>
                  {config.label} ({Math.round(dimension.score)}/100)
                </Text>
                <Text style={styles.highlightText}>{dimension.reasoning}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.highlightsSection}>
          <Text style={styles.sectionTitle}>Areas for Improvement</Text>
          {weaknesses.map(([key, dimension]) => {
            const config = DIMENSIONS[key as DimensionKey];
            return (
              <View key={key} style={[styles.highlight, styles.highlightWeakness]}>
                <Text style={styles.dimensionName}>
                  {config.label} ({Math.round(dimension.score)}/100)
                </Text>
                <Text style={styles.highlightText}>{dimension.reasoning}</Text>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Story Magic - StoryScore Report</Text>
          <Text style={styles.pageNumber}>Page 2</Text>
        </View>
      </Page>
    </Document>
  );
}

export default StoryScorePDF;
