import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { PRESET_COLORS } from '../types/settings';
import { spacing, borderRadius, typography, shadows } from '../constants/theme';

interface ColorPickerProps {
  visible: boolean;
  onClose: () => void;
  selectedColor: string;
  onSelect: (color: string) => void;
  colors: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper to convert HSL to Hex
function hslToHex(h: number, s: number, l: number) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Helper to extract Hue from Hex (more robust)
function hexToHue(hex: string): number {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 0;
  
  // Handle 3-digit hex
  let fullHex = hex;
  if (hex.length === 4) {
    fullHex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }

  const r = parseInt(fullHex.slice(1, 3), 16) / 255;
  const g = parseInt(fullHex.slice(3, 5), 16) / 255;
  const b = parseInt(fullHex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;

  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return Math.round(h * 360);
}

export function ColorPicker({
  visible,
  onClose,
  selectedColor,
  onSelect,
  colors,
}: ColorPickerProps) {
  const [hue, setHue] = useState(hexToHue(selectedColor));

  // Only initialize hue when the picker becomes visible
  useEffect(() => {
    if (visible) {
      setHue(hexToHue(selectedColor));
    }
  }, [visible]);

  const handleHueChange = (value: number) => {
    setHue(value);
    const hex = hslToHex(value, 70, 55);
    onSelect(hex);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.content, { backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Choose Color</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Presets</Text>
          <View style={styles.grid}>
            {PRESET_COLORS.map((item) => (
              <TouchableOpacity
                key={item.color}
                style={[
                  styles.swatch,
                  { backgroundColor: item.color },
                  selectedColor.toLowerCase() === item.color.toLowerCase() && {
                    borderWidth: 3,
                    borderColor: colors.foreground,
                  },
                ]}
                onPress={() => {
                  onSelect(item.color);
                  onClose();
                }}
              >
                {selectedColor.toLowerCase() === item.color.toLowerCase() && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Custom Color</Text>
          
          <View style={[styles.preview, { backgroundColor: selectedColor }]} />

          <View style={styles.sliderContainer}>
            <LinearGradient
              colors={[
                '#FF0000',
                '#FFFF00',
                '#00FF00',
                '#00FFFF',
                '#0000FF',
                '#FF00FF',
                '#FF0000',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradient}
            />
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={360}
              step={1}
              value={hue}
              onValueChange={handleHueChange}
              onSlidingComplete={handleHueChange}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor="white"
            />
          </View>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.primary }]}
            onPress={onClose}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.xl,
  },
  sectionLabel: {
    fontFamily: typography.fontFamily.medium,
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginBottom: spacing.xl,
  },
  preview: {
    height: 60,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  gradient: {
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    left: 0,
    right: 0,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  doneButton: {
    height: 50,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  doneButtonText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: typography.fontSize.base,
    color: 'white',
  },
});
