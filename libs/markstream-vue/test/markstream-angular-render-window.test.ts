import { describe, expect, it } from 'vitest'
import {
  computeLiveRange,
  DEFAULT_NODE_HEIGHT,
  estimateHeightRange,
  resolveAverageNodeHeight,
  resolveDeferNodes,
  resolveVirtualizationEnabled,
} from '../packages/markstream-angular/src/components/shared/render-window'

describe('markstream-angular render window helpers', () => {
  it('computes a bounded live range around the focus index', () => {
    expect(computeLiveRange(0, 0, 5, 2)).toEqual({ start: 0, end: 0 })
    expect(computeLiveRange(10, 0, 5, 2)).toEqual({ start: 0, end: 4 })
    expect(computeLiveRange(10, 9, 5, 2)).toEqual({ start: 6, end: 10 })
    expect(computeLiveRange(100, 50, 9, 3)).toEqual({ start: 46, end: 55 })
  })

  it('estimates placeholder heights from measured nodes and falls back to the average', () => {
    const nodeHeights = new Map<number, number>([
      [0, 40],
      [1, 24],
      [4, 56],
    ])

    const average = resolveAverageNodeHeight(nodeHeights)
    expect(average).toBeCloseTo(40, 0)
    expect(resolveAverageNodeHeight(new Map())).toBe(DEFAULT_NODE_HEIGHT)
    expect(estimateHeightRange(0, 3, nodeHeights, average)).toBeCloseTo(104, 0)
  })

  it('only defers nodes when virtualization is off and viewport priority is enabled', () => {
    expect(resolveVirtualizationEnabled(500, 320)).toBe(true)
    expect(resolveVirtualizationEnabled(100, 320)).toBe(false)
    expect(resolveVirtualizationEnabled(500, 0)).toBe(false)
    expect(resolveVirtualizationEnabled(500, -1)).toBe(false)

    expect(resolveDeferNodes({
      parsedNodeCount: 120,
      virtualizationEnabled: false,
      viewportPriority: true,
      deferNodesUntilVisible: true,
      maxLiveNodes: 320,
    })).toBe(true)

    expect(resolveDeferNodes({
      parsedNodeCount: 1200,
      virtualizationEnabled: false,
      viewportPriority: true,
      deferNodesUntilVisible: true,
      maxLiveNodes: 320,
    })).toBe(false)

    expect(resolveDeferNodes({
      parsedNodeCount: 120,
      virtualizationEnabled: true,
      viewportPriority: true,
      deferNodesUntilVisible: true,
      maxLiveNodes: 320,
    })).toBe(false)

    expect(resolveDeferNodes({
      parsedNodeCount: 120,
      virtualizationEnabled: false,
      viewportPriority: true,
      deferNodesUntilVisible: true,
      maxLiveNodes: 0,
    })).toBe(false)
  })
})
