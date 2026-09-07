import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
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
  const destination = incident?.location ?? { lat: 12.9352, lng: 77.6245 };
  const dispatchPoint = { latitude: 12.9716, longitude: 77.5946 };
  const nativeRegion = {
    latitude: destination.lat,
    longitude: destination.lng,
    latitudeDelta: 0.055,
    longitudeDelta: 0.055,
  };
  return (
    <View
      accessible
      accessibilityLabel="Google Map showing your location and the MediHelp drone route"
      style={[
        styles.map,
        compact ? styles.compact : styles.full,
        { backgroundColor: colors.secondary, borderColor: colors.border },
      ]}
    >
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        region={nativeRegion}
        showsUserLocation={Boolean(incident)}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title="Your location"
          description={incident?.address ?? 'MediHelp service area'}
          pinColor={colors.destructive}
        />
        {incident ? (
          <>
            <Marker
              coordinate={{
                latitude: dispatchPoint.latitude + 0.022,
                longitude: dispatchPoint.longitude + 0.026,
              }}
              title={`Drone ${incident.droneId}`}
              description={`${incident.battery}% battery · ${incident.etaMinutes} min ETA`}
              pinColor={colors.primary}
            />
            <Polyline
              coordinates={[
                dispatchPoint,
                {
                  latitude: dispatchPoint.latitude + 0.022,
                  longitude: dispatchPoint.longitude + 0.026,
                },
                { latitude: destination.lat, longitude: destination.lng },
              ]}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          </>
        ) : null}
      </MapView>
      <View style={[styles.mapLabel, { backgroundColor: colors.card }]}>
        <Feather name="map-pin" size={12} color={colors.destructive} />
        <Text style={[styles.label, { color: colors.foreground }]}>Google Maps · Bengaluru</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { overflow: 'hidden', borderWidth: 1, borderRadius: 22, position: 'relative' },
  compact: { height: 138 },
  full: { height: 270 },
  mapLabel: { position: 'absolute', left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, flexDirection: 'row', gap: 5, alignItems: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});