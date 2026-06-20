// Catches render-time errors anywhere in the tree so a single bad screen shows
// a friendly recovery card instead of a white screen / crash.

import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a console trace for dev; no remote logging (offline-first).
    console.warn('ErrorBoundary caught:', error?.message);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>🌱</Text>
        <Text style={type.h2}>問題が発生しました</Text>
        <Text style={[type.muted, { textAlign: 'center' }]}>
          画面の表示中にエラーが起きました。データは端末内に保存されているので失われていません。
        </Text>
        <Pressable style={styles.btn} onPress={this.reset}>
          <Text style={styles.btnText}>もう一度ひらく</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emoji: { fontSize: 44 },
  btn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 14 },
  btnText: { fontFamily: fonts.maru, fontSize: 16, color: '#fff' },
});
