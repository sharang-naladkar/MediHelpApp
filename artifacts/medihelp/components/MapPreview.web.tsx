import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Incident } from '@/services/medihelpRepository';

export function MapPreview({
  incident,
  compact = false,
}: {
  incident?: Incident | null;
  compact?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      accessible
      accessibilityLabel="Map showing your location and the MediHelp drone route"
      style={[
        styles.map,
        compact ? styles.compact : styles.full,
        { backgroundColor: colors.secondary, borderColor: colors.border },
      ]}
    >
      <View style={[styles.gridLine, styles.gridOne, { backgroundColor: colors.border }]} />
      <View style={[styles.gridLine, styles.gridTwo, { backgroundColor: colors.border }]} />
      <View style={[styles.gridLine, styles.gridThree, { backgroundColor: colors.border }]} />
      <View style={[styles.road, styles.roadA, { backgroundColor: colors.background }]} />
      <View style={[styles.road, styles.roadB, { backgroundColor: colors.background }]} />
      <View style={[styles.route, { backgroundColor: colors.primary }]} />
      <View style={[styles.destination, { backgroundColor: colors.destructive, borderColor: colors.background }]}>
        <Feather name="plus" size={compact ? 13 : 18} color="#fff" />
      </View>
      {incident ? (
        <View style={[styles.drone, { backgroundColor: colors.primary, borderColor: colors.background }]}>
          <Feather name="navigation" size={compact ? 12 : 16} color="#fff" />
        </View>
      ) : null}
      <View style={[styles.mapLabel, { backgroundColor: colors.card }]}>
        <Feather name="map-pin" size={12} color={colors.destructive} />
        <Text style={[styles.label, { color: colors.foreground }]}>Web map preview</Text>
      </View>
      <Text style={[styles.mapCaption, { color: colors.mutedForeground }]}>
        {incident ? 'Live route preview' : 'Location ready'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', borderWidth: 1, borderRadius: 22, position: 'relative' },
  compact: { height: 138 },
  full: { height: 270 },
  gridLine: { position: 'absolute', opacity: 0.5 },
  gridOne: { left: '20%', top: 0, bottom: 0, width: 1 },
  gridTwo: { left: '70%', top: 0, bottom: 0, width: 1 },
  gridThree: { left: 0, right: 0, top: '48%', height: 1 },
  road: { position: 'absolute', opacity: 0.85 },
  roadA: { width: '140%', height: 18, top: '45%', left: '-10%', transform: [{ rotate: '-15deg' }] },
  roadB: { width: 18, height: '130%', left: '57%', top: '-15%', transform: [{ rotate: '24deg' }] },
  route: { position: 'absolute', width: 4, height: '62%', left: '49%', top: '18%', borderRadius: 4, transform: [{ rotate: '28deg' }] },
  destination: { position: 'absolute', left: '24%', top: '58%', width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  drone: { position: 'absolute', right: '20%', top: '22%', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  mapLabel: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, flexDirection: 'row', gap: 5, alignItems: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  mapCaption: { position: 'absolute', right: 14, bottom: 12, fontFamily: 'Inter_500Medium', fontSize: 11 },
});