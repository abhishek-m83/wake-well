// ============================================================
// WakeWell — Analytics Screen
// ============================================================
// Sleep dashboard with trends, scores, and insights.
// ============================================================

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useSleepAnalytics } from '../hooks';
import { COLORS, SPACING, BORDER_RADIUS, ANALYTICS_CONFIG } from '../constants';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const stats = useSleepAnalytics();

  const renderStatCard = (icon, label, value, unit, color) => (
    <View style={styles.statCard}>
      <Icon name={icon} size={20} color={color || COLORS.primaryLight} />
      <Text style={styles.statValue}>{value}<Text style={styles.statUnit}> {unit}</Text></Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderBarChart = () => {
    if (!stats.weeklyTrend || stats.weeklyTrend.length === 0) return null;
    const maxDuration = Math.max(...stats.weeklyTrend.map(d => d.duration || 0), 9);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Sleep Duration (Last 7 nights)</Text>
        <View style={styles.barChart}>
          {stats.weeklyTrend.map((day, idx) => {
            const barHeight = day.duration > 0 ? (day.duration / maxDuration) * 120 : 0;
            const dayLabel = new Date(day.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0);
            return (
              <View key={idx} style={styles.barColumn}>
                <Text style={styles.barValue}>
                  {day.duration > 0 ? `${day.duration.toFixed(1)}h` : '-'}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: barHeight,
                        backgroundColor: day.duration >= 7 ? COLORS.success
                          : day.duration >= 6 ? COLORS.accent
                          : COLORS.danger,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{dayLabel}</Text>
              </View>
            );
          })}
        </View>
        {/* Reference line */}
        <View style={styles.referenceLine}>
          <View style={styles.refLine} />
          <Text style={styles.refLabel}>7h recommended</Text>
        </View>
      </View>
    );
  };

  const renderFreshnessTrend = () => {
    if (!stats.weeklyTrend || stats.weeklyTrend.length === 0) return null;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Wake Freshness (Last 7 days)</Text>
        <View style={styles.freshnessDots}>
          {stats.weeklyTrend.map((day, idx) => {
            const config = ANALYTICS_CONFIG.FRESHNESS_SCALE[day.freshness] ||
              ANALYTICS_CONFIG.FRESHNESS_SCALE[3];
            return (
              <View key={idx} style={styles.freshnessDay}>
                <Text style={styles.freshnessEmoji}>
                  {day.freshness > 0 ? config.emoji : '·'}
                </Text>
                <Text style={styles.freshnessScore}>
                  {day.freshness > 0 ? day.freshness : '-'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Sleep Analytics</Text>
        <Text style={styles.subtitle}>
          {stats.totalNights > 0
            ? `${stats.totalNights} nights tracked`
            : 'Start tracking to see your sleep insights'}
        </Text>

        {stats.totalNights === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="bar-chart-2" size={64} color={COLORS.nightLight} />
            <Text style={styles.emptyTitle}>No sleep data yet</Text>
            <Text style={styles.emptyText}>
              Set an alarm and use sleep tracking to see your analytics here.
              The more nights you track, the better your insights get.
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Stats */}
            <View style={styles.statsGrid}>
              {renderStatCard('clock', 'Avg Duration', stats.averageDuration, 'hrs', COLORS.primaryLight)}
              {renderStatCard('sun', 'Avg Freshness', stats.averageFreshness, '/ 5', COLORS.accent)}
              {renderStatCard('target', 'Consistency', stats.consistencyScore, '%', COLORS.success)}
              {renderStatCard('zap', 'Streak', stats.streak, 'nights', COLORS.dawnPink)}
            </View>

            {/* Sleep Duration Chart */}
            {renderBarChart()}

            {/* Freshness Trend */}
            {renderFreshnessTrend()}

            {/* Insights */}
            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>
                <Icon name="lightbulb" size={16} color={COLORS.accent} /> Insights
              </Text>

              {stats.averageDuration < 7 && (
                <View style={styles.insightRow}>
                  <View style={[styles.insightDot, { backgroundColor: COLORS.warning }]} />
                  <Text style={styles.insightText}>
                    You're averaging {stats.averageDuration}h — try to aim for 7-8h for optimal recovery.
                  </Text>
                </View>
              )}

              {stats.consistencyScore < 60 && (
                <View style={styles.insightRow}>
                  <View style={[styles.insightDot, { backgroundColor: COLORS.dawnPink }]} />
                  <Text style={styles.insightText}>
                    Your bedtime varies a lot. A consistent sleep schedule helps your body clock sync.
                  </Text>
                </View>
              )}

              {stats.averageFreshness >= 4 && (
                <View style={styles.insightRow}>
                  <View style={[styles.insightDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.insightText}>
                    Great wake freshness! The smart alarm seems to be finding good wake windows for you.
                  </Text>
                </View>
              )}

              {stats.streak >= 7 && (
                <View style={styles.insightRow}>
                  <View style={[styles.insightDot, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.insightText}>
                    Amazing {stats.streak}-night streak! Consistent tracking gives you the best insights.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.nightDeep },
  scrollContent: { padding: SPACING.lg, paddingTop: SPACING.xxl + 16, paddingBottom: 100 },
  title: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '600' },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACING.xs, marginBottom: SPACING.xl },
  emptyState: { alignItems: 'center', paddingTop: SPACING.xxl * 2, gap: SPACING.md },
  emptyTitle: { fontSize: 20, color: COLORS.textSecondary, fontWeight: '500' },
  emptyText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.xl },
  statCard: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  statValue: { fontSize: 28, color: COLORS.textPrimary, fontWeight: '600', marginTop: SPACING.sm },
  statUnit: { fontSize: 14, color: COLORS.textMuted, fontWeight: '400' },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  chartContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chartTitle: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600', marginBottom: SPACING.md },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160 },
  barColumn: { alignItems: 'center', flex: 1 },
  barValue: { fontSize: 10, color: COLORS.textMuted, marginBottom: 4 },
  barTrack: { width: 20, height: 120, justifyContent: 'flex-end', borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.nightLight },
  barFill: { width: '100%', borderRadius: 10 },
  barLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  referenceLine: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: SPACING.sm },
  refLine: { flex: 1, height: 1, backgroundColor: COLORS.textMuted, opacity: 0.3 },
  refLabel: { fontSize: 10, color: COLORS.textMuted },
  freshnessDots: { flexDirection: 'row', justifyContent: 'space-between' },
  freshnessDay: { alignItems: 'center', flex: 1 },
  freshnessEmoji: { fontSize: 24 },
  freshnessScore: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  insightsCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  insightsTitle: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '600', marginBottom: SPACING.md },
  insightRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md, alignItems: 'flex-start' },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  insightText: { fontSize: 13, color: COLORS.textSecondary, flex: 1, lineHeight: 20 },
});
