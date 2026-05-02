import { renderHook, act } from '@testing-library/react-hooks';
import { useUpdateStore } from '../useUpdateStore';

describe('useUpdateStore', () => {
  let result;

  beforeEach(() => {
    result = renderHook(() => useUpdateStore()).result;
  });

  it('should manage version correctly', () => {
    act(() => {
      result.current.setVersion('1.0.0');
    });
    expect(result.current.version).toBe('1.0.0');
  });

  it('should toggle auto update', () => {
    act(() => {
      result.current.toggleAutoUpdate();
    });
    expect(result.current.autoUpdate).toBe(true);
    
    act(() => {
      result.current.toggleAutoUpdate();
    });
    expect(result.current.autoUpdate).toBe(false);
  });

  it('should ignore specific updates', () => {
    act(() => {
      result.current.ignoreUpdate('1.0.1');
    });
    expect(result.current.ignoredUpdates).toContain('1.0.1');
  });

  it('should select the correct update stream', () => {
    act(() => {
      result.current.setUpdateStream('beta');
    });
    expect(result.current.updateStream).toBe('beta');
  });

  it('should enable Wi-Fi only toggle', () => {
    act(() => {
      result.current.toggleWifiOnly();
    });
    expect(result.current.wifiOnly).toBe(true);
    
    act(() => {
      result.current.toggleWifiOnly();
    });
    expect(result.current.wifiOnly).toBe(false);
  });
});
