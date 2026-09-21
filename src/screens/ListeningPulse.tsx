import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';
import { color } from '../theme/tokens';

const RING_SIZE = 120;
const PULSE_DURATION_MS = 2200;

/**
 * The single hero element on the home screen: a slow, calm pulse that reads
 * as "always listening" without feeling anxious. Deliberately slower and
 * gentler than the alarm screen's motion, so the contrast between "safe/
 * watching" and "active emergency" is felt, not just labeled.
 */
export function ListeningPulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: PULSE_DURATION_MS,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: PULSE_DURATION_MS,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.ring, { transform: [{ scale }], opacity }]}
      />
      <View style={styles.core} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: color.guardianDim,
  },
  core: {
    width: RING_SIZE * 0.4,
    height: RING_SIZE * 0.4,
    borderRadius: (RING_SIZE * 0.4) / 2,
    backgroundColor: color.guardian,
  },
});
