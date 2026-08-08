import { ScrollView } from 'react-native';
import { spacing } from '../lib/theme';
import { Chip } from './ui';

// Horizontal scroll of tag chips for filtering (Pro). Tap a tag to toggle.
export function TagFilter({
  tags,
  selected,
  onSelect,
}: {
  tags: string[];
  selected: string | null;
  onSelect: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: 2 }}
    >
      {tags.map((t) => (
        <Chip
          key={t}
          label={`#${t}`}
          tone="primary"
          active={selected === t}
          onPress={() => onSelect(selected === t ? null : t)}
        />
      ))}
    </ScrollView>
  );
}
