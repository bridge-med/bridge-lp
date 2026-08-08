// Swipe-left-to-delete wrapper built on the built-in Animated + PanResponder
// (no extra native deps). A confirmation dialog guards against accidents.

import { useRef } from 'react';
import { Alert, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { spacing } from '../lib/theme';
import { tapLight } from '../lib/haptics';

const THRESHOLD = -96;

export function SwipeRow({
  children,
  onDelete,
  confirmTitle = '削除しますか？',
}: {
  children: React.ReactNode;
  onDelete: () => void;
  confirmTitle?: string;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const reset = () => Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderMove: (_e, g) => {
        const x = Math.max(-140, Math.min(0, g.dx));
        tx.setValue(x);
        if (x <= THRESHOLD && !triggered.current) {
          triggered.current = true;
          tapLight();
        } else if (x > THRESHOLD) {
          triggered.current = false;
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= THRESHOLD) {
          reset();
          Alert.alert(confirmTitle, 'この操作は取り消せません。', [
            { text: 'キャンセル', style: 'cancel' },
            { text: '削除', style: 'destructive', onPress: onDelete },
          ]);
        } else {
          reset();
        }
        triggered.current = false;
      },
      onPanResponderTerminate: reset,
    }),
  ).current;

  return (
    <View>
      <View style={styles.behind}>
        <Text style={styles.behindText}>削除</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  behind: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#b91c1c',
    borderRadius: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: spacing.xl,
  },
  behindText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
