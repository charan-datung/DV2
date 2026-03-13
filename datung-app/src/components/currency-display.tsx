import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { formatCentavos } from '../utils/currency';

interface Props {
  centavos: number;
  style?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export default function CurrencyDisplay({ centavos, style, size = 'md' }: Props) {
  const fontSize = size === 'sm' ? 14 : size === 'lg' ? 28 : 18;
  return (
    <Text style={[styles.text, { fontSize }, style]}>
      {formatCentavos(centavos)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '700',
    color: '#1A1A2E',
  },
});
