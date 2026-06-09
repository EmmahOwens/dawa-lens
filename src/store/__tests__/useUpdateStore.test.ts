import { renderHook, act } from '@testing-library/react';
import { useUpdateStore } from '../useUpdateStore';

describe('useUpdateStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useUpdateStore());
    act(() => {
      // Reset store state before each test
      result.current.setAutoUpdate(false);
      result.current.setWifiOnly(false);
      result.current.setCurrentVersion('1.0.0');
      result.current.setLatestVersion('1.0.0');
    });
  });

  it('should manage version correctly', () => {
    const { result } = renderHook(() => useUpdateStore());
    act(() => {
      result.current.setCurrentVersion('1.1.0');
    });
    expect(result.current.currentVersion).toBe('1.1.0');
  });

  it('should set auto update', () => {
    const { result } = renderHook(() => useUpdateStore());
    act(() => {
      result.current.setAutoUpdate(true);
    });
    expect(result.current.autoUpdate).toBe(true);
    
    act(() => {
      result.current.setAutoUpdate(false);
    });
    expect(result.current.autoUpdate).toBe(false);
  });

  it('should ignore specific updates', () => {
    const { result } = renderHook(() => useUpdateStore());
    act(() => {
      result.current.ignoreUpdate('1.0.1');
    });
    expect(result.current.ignoredUpdates).toContain('1.0.1');
  });

  it('should set Wi-Fi only toggle', () => {
    const { result } = renderHook(() => useUpdateStore());
    act(() => {
      result.current.setWifiOnly(true);
    });
    expect(result.current.wifiOnly).toBe(true);
    
    act(() => {
      result.current.setWifiOnly(false);
    });
    expect(result.current.wifiOnly).toBe(false);
  });

  it('should correctly identify if an update is available', () => {
    const { result } = renderHook(() => useUpdateStore());
    
    act(() => {
      result.current.setCurrentVersion('1.0.0');
      result.current.setLatestVersion('1.0.1');
    });
    expect(result.current.isUpdateAvailable()).toBe(true);

    act(() => {
      result.current.setCurrentVersion('1.0.0');
      result.current.setLatestVersion('1.0.0');
    });
    expect(result.current.isUpdateAvailable()).toBe(false);

    act(() => {
      result.current.setCurrentVersion('1.1.0');
      result.current.setLatestVersion('1.0.9');
    });
    expect(result.current.isUpdateAvailable()).toBe(false);
  });
});
