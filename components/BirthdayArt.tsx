import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export function BirthdayArt() {
    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Main vibrant gradient background */}
            <LinearGradient
                colors={['#FF9DFA', '#FFD59D', '#FFE8A1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Decorative Glows */}
            <View style={[styles.glow, { top: -20, right: -20, backgroundColor: '#FFFFFF', opacity: 0.3 }]} />
            <View style={[styles.glow, { bottom: -30, left: '20%', backgroundColor: '#FFD700', opacity: 0.4, width: 100, height: 100 }]} />

            {/* Balloons */}
            <View style={[styles.balloon, { bottom: 10, left: 15, backgroundColor: '#4A90E2', transform: [{ rotate: '15deg' }] }]}>
                <View style={styles.balloonHighlight} />
            </View>
            <View style={[styles.balloon, { bottom: 25, left: 5, backgroundColor: '#FF4081', width: 22, height: 26, transform: [{ rotate: '-10deg' }] }]}>
                <View style={styles.balloonHighlight} />
            </View>
            <View style={[styles.balloon, { bottom: 20, right: 30, backgroundColor: '#FF4081', width: 28, height: 32, transform: [{ rotate: '5deg' }] }]}>
                <View style={styles.balloonHighlight} />
            </View>
            <View style={[styles.balloon, { top: 10, right: 10, backgroundColor: '#4FC3F7', width: 20, height: 24, opacity: 0.6 }]}>
                <View style={styles.balloonHighlight} />
            </View>

            {/* Confetti/Sparkles */}
            <View style={[styles.sparkle, { top: '20%', left: '40%' }]} />
            <View style={[styles.sparkle, { top: '60%', right: '25%' }]} />
            <View style={[styles.sparkle, { top: '30%', left: '15%', backgroundColor: '#FFFFFF' }]} />
            <View style={[styles.sparkle, { bottom: '25%', left: '45%', width: 3, height: 3 }]} />
            <View style={[styles.sparkle, { top: '10%', right: '15%', width: 5, height: 5, backgroundColor: '#FFD700' }]} />

            <View style={[styles.confetti, { top: 15, right: '35%', backgroundColor: '#FFEB3B', transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.confetti, { bottom: 30, right: '15%', backgroundColor: '#E91E63', transform: [{ rotate: '-20deg' }] }]} />
            <View style={[styles.confetti, { top: '50%', left: '10%', backgroundColor: '#00BCD4', width: 4, height: 6, transform: [{ rotate: '110deg' }] }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    glow: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        filter: 'blur(30px)', // Note: standard React Native doesn't support filter, we'll use opacity/gradients mostly
    },
    balloon: {
        position: 'absolute',
        width: 25,
        height: 30,
        borderRadius: 15,
        overflow: 'hidden',
    },
    balloonHighlight: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 6,
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 4,
    },
    sparkle: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFF59D',
        opacity: 0.8,
    },
    confetti: {
        position: 'absolute',
        width: 6,
        height: 8,
        borderRadius: 1,
        opacity: 0.6,
    },
});
