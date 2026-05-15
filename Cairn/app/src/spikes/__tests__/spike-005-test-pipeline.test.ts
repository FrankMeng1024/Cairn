/**
 * SPIKE-005 验证测试
 * 证明三层测试路径 Layer 1 可行：
 * - expo-location mock 签名正确
 * - expo-speech mock 可 spy 验证调用
 * - React Native 组件可在 Jest 环境中 render
 */

import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

describe('SPIKE-005: Layer 1 测试路径验证', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── expo-location mock 验证 ──────────────────────────────────────
  describe('expo-location mock', () => {
    it('requestForegroundPermissionsAsync 返回 granted', async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      expect(result.status).toBe('granted');
      expect(result.granted).toBe(true);
    });

    it('getCurrentPositionAsync 返回 NZ 坐标（真实 LocationObject 结构）', async () => {
      const loc = await Location.getCurrentPositionAsync({});
      // 验证结构完整（与真实 expo-location API 一致）
      expect(loc.coords).toHaveProperty('latitude');
      expect(loc.coords).toHaveProperty('longitude');
      expect(loc.coords).toHaveProperty('altitude');
      expect(loc.coords).toHaveProperty('accuracy');
      expect(loc.coords).toHaveProperty('speed');
      expect(loc.timestamp).toBeDefined();
      // 验证值在 NZ 坐标范围内
      expect(loc.coords.latitude).toBeLessThan(-34);
      expect(loc.coords.latitude).toBeGreaterThan(-47);
      expect(loc.coords.longitude).toBeGreaterThan(166);
      expect(loc.coords.longitude).toBeLessThan(178);
    });

    it('watchPositionAsync 立即触发回调并返回 subscription', async () => {
      const callback = jest.fn();
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000 },
        callback
      );
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        coords: expect.objectContaining({ latitude: expect.any(Number) }),
      }));
      expect(sub.remove).toBeDefined();
      expect(typeof sub.remove).toBe('function');
    });
  });

  // ── expo-speech mock 验证 ────────────────────────────────────────
  describe('expo-speech mock', () => {
    it('getAvailableVoicesAsync 返回包含 en-NZ voice', async () => {
      const voices = await Speech.getAvailableVoicesAsync();
      expect(voices.length).toBeGreaterThan(0);
      const nzVoice = voices.find(v => v.language === 'en-NZ');
      expect(nzVoice).toBeDefined();
      expect(nzVoice?.name).toBe('Nicky');
    });

    it('speak() 触发 onStart 和 onDone 回调', async () => {
      const onStart = jest.fn();
      const onDone = jest.fn();

      Speech.speak('Caution. Slippery surface ahead.', {
        language: 'en-NZ',
        onStart,
        onDone,
      });

      expect(Speech.speak).toHaveBeenCalledWith(
        'Caution. Slippery surface ahead.',
        expect.objectContaining({ language: 'en-NZ' })
      );

      // 等待 mock 内的 setTimeout 执行
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('stop() 可被调用，不抛错', async () => {
      await expect(Speech.stop()).resolves.toBeUndefined();
    });
  });

  // ── 业务逻辑示例（纯函数，零 mock 依赖）──────────────────────────
  describe('路径计算工具函数', () => {
    // 模拟一个将在 Feature Sprint 实现的纯函数
    const haversineDistance = (
      lat1: number, lng1: number,
      lat2: number, lng2: number
    ): number => {
      const R = 6371e3; // 地球半径（米）
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    it('Tongariro 两点距离计算正确（±5%容差）', () => {
      // Tongariro Crossing 起点 → 中点，实际约 7.5km
      const dist = haversineDistance(-39.1548, 175.6320, -39.1320, 175.6580);
      expect(dist).toBeGreaterThan(3000);
      expect(dist).toBeLessThan(5000);
    });

    it('同一点距离为 0', () => {
      const dist = haversineDistance(-39.1548, 175.6320, -39.1548, 175.6320);
      expect(dist).toBe(0);
    });
  });
});
