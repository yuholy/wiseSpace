import { useCallback, useEffect, useRef, useState } from 'react'

export interface ChunkInfo {
  content: string
  delay: number
  index: number
}

export interface LocalStreamControl {
  shouldPause?: () => boolean
  signal?: AbortSignal
}

export type StreamSliceMode = 'pure-random' | 'boundary-aware'
export type StreamTransportMode = 'scheduler' | 'readable-stream'

export interface StreamSimulatorOptions {
  source: string
  chunkSizeMin: number
  chunkSizeMax: number
  chunkDelayMin: number
  chunkDelayMax: number
  burstiness: number
  sliceMode?: StreamSliceMode
  transportMode?: StreamTransportMode
  random?: () => number
}

export interface CreateLocalTextStreamOptions {
  chunkSizeMin: number
  chunkSizeMax: number
  chunkDelayMin: number
  chunkDelayMax: number
  onChunk?: (chunk: ChunkInfo) => void
  control?: LocalStreamControl
  random?: () => number
  sliceMode?: StreamSliceMode
}

const WORD_BOUNDARY = /[\s,.;:!?()[\]{}"'`<>/\-\\]/

interface BurstState {
  quickChunksRemaining: number
  fastCadenceChunkPending: boolean
}

export function clampStreamControl(value: number, min: number, max: number, fallback: number) {
  const normalized = Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, normalized))
}

export function normalizeStreamRange(
  minValue: number,
  maxValue: number,
  lowerBound: number,
  upperBound: number,
  fallbackMin: number,
  fallbackMax: number,
) {
  const normalizedMin = Math.round(clampStreamControl(minValue, lowerBound, upperBound, fallbackMin))
  const normalizedMax = Math.round(clampStreamControl(maxValue, lowerBound, upperBound, fallbackMax))

  if (normalizedMin <= normalizedMax)
    return { min: normalizedMin, max: normalizedMax }

  return { min: normalizedMax, max: normalizedMin }
}

function normalizeRatio(value: number, fallback: number) {
  return clampStreamControl(value, 0, 1, fallback)
}

function randomBetween(min: number, max: number, random: () => number) {
  return min + ((max - min) * random())
}

function randomInt(min: number, max: number, random: () => number) {
  return Math.floor(randomBetween(min, max + 1, random))
}

function isBoundaryChar(char: string | undefined) {
  return char ? WORD_BOUNDARY.test(char) : false
}

function snapChunkToBoundary(source: string, start: number, desiredChunk: number) {
  const preferredEnd = Math.min(source.length, start + desiredChunk)
  if (preferredEnd >= source.length)
    return source.length - start

  if (isBoundaryChar(source[preferredEnd - 1]) || isBoundaryChar(source[preferredEnd]))
    return preferredEnd - start

  const lookaheadEnd = Math.min(source.length, preferredEnd + 12)
  for (let index = preferredEnd; index < lookaheadEnd; index++) {
    if (isBoundaryChar(source[index]))
      return (index + 1) - start
  }

  return preferredEnd - start
}

function sampleChunkSizeFromRange(
  source: string,
  start: number,
  chunkSizeMin: number,
  chunkSizeMax: number,
  burstState: BurstState,
  sliceMode: StreamSliceMode,
  random: () => number,
) {
  const remaining = source.length - start
  if (remaining <= 0)
    return 0

  const range = Math.max(0, chunkSizeMax - chunkSizeMin)
  if (sliceMode === 'pure-random') {
    const chunkSize = range === 0
      ? chunkSizeMin
      : randomInt(chunkSizeMin, chunkSizeMax, random)
    return Math.max(1, Math.min(remaining, chunkSize))
  }

  if (range === 0)
    return Math.min(remaining, chunkSizeMin)

  const useBurstChunkBias = burstState.fastCadenceChunkPending || burstState.quickChunksRemaining > 0
  const useLowWindow = !useBurstChunkBias && random() < 0.22
  let chunkSize = chunkSizeMax

  if (useBurstChunkBias) {
    const burstMin = Math.max(chunkSizeMin, chunkSizeMax - Math.max(1, Math.floor(range * 0.35)))
    chunkSize = randomInt(burstMin, chunkSizeMax, random)
  }
  else if (useLowWindow) {
    const lowMax = Math.min(chunkSizeMax, chunkSizeMin + Math.max(1, Math.floor(range * 0.4)))
    chunkSize = randomInt(chunkSizeMin, lowMax, random)
  }
  else {
    chunkSize = randomInt(chunkSizeMin, chunkSizeMax, random)
  }

  chunkSize = Math.min(remaining, chunkSize)
  if (remaining > 6 && random() < 0.72)
    chunkSize = Math.min(remaining, snapChunkToBoundary(source, start, chunkSize))

  return Math.max(1, chunkSize)
}

function sampleDelayMsFromRange(
  chunkDelayMin: number,
  chunkDelayMax: number,
  burstiness: number,
  burstState: BurstState,
  isFirstChunk: boolean,
  pureRandom: boolean,
  random: () => number,
) {
  const range = Math.max(0, chunkDelayMax - chunkDelayMin)
  if (range === 0)
    return chunkDelayMin

  if (pureRandom)
    return randomInt(chunkDelayMin, chunkDelayMax, random)

  const fastCadence = burstState.quickChunksRemaining > 0
  if (fastCadence) {
    const quickMax = Math.min(chunkDelayMax, chunkDelayMin + Math.max(1, Math.floor(range * 0.3)))
    burstState.fastCadenceChunkPending = true
    return randomInt(chunkDelayMin, quickMax, random)
  }

  const shouldStall = burstiness > 0.05 && random() < (burstiness * 0.24)
  const shouldBurst = burstiness > 0.08 && random() < (burstiness * 0.18)

  let delayMs: number
  if (isFirstChunk) {
    const warmupMin = Math.min(chunkDelayMax, chunkDelayMin + Math.max(1, Math.floor(range * 0.45)))
    delayMs = randomInt(warmupMin, chunkDelayMax, random)
  }
  else if (shouldStall) {
    const stallMin = Math.max(chunkDelayMin, chunkDelayMax - Math.max(1, Math.floor(range * 0.35)))
    delayMs = randomInt(stallMin, chunkDelayMax, random)
    burstState.quickChunksRemaining = randomInt(1, 2 + Math.round(burstiness * 4), random)
  }
  else {
    delayMs = randomInt(chunkDelayMin, chunkDelayMax, random)
    if (shouldBurst)
      burstState.quickChunksRemaining = randomInt(1, 2 + Math.round(burstiness * 4), random)
  }

  return delayMs
}

export function createLocalTextStream(content: string, options: CreateLocalTextStreamOptions) {
  const encoder = new TextEncoder()
  const random = options.random ?? Math.random
  const control = options.control ?? {}
  let currentPosition = 0
  let chunkIndex = 0

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const waitIfPaused = async () => {
    while (control.shouldPause?.()) {
      if (control.signal?.aborted)
        return
      await sleep(50)
    }
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      while (currentPosition < content.length) {
        if (control.signal?.aborted)
          break

        await waitIfPaused()
        if (control.signal?.aborted)
          break

        const rawChunkSize = randomInt(options.chunkSizeMin, options.chunkSizeMax, random)
        const chunkSize = options.sliceMode === 'boundary-aware'
          ? snapChunkToBoundary(content, currentPosition, rawChunkSize)
          : rawChunkSize
        const delay = randomInt(options.chunkDelayMin, options.chunkDelayMax, random)
        const chunkContent = content.slice(currentPosition, currentPosition + chunkSize)

        await sleep(delay)
        if (control.signal?.aborted)
          break

        await waitIfPaused()
        if (control.signal?.aborted)
          break

        controller.enqueue(encoder.encode(chunkContent))
        options.onChunk?.({
          index: chunkIndex++,
          content: chunkContent,
          delay,
        })

        currentPosition += chunkSize
      }

      try {
        controller.close()
      }
      catch {
        // The consumer may have already canceled the stream.
      }
    },
  })
}

export function useStreamSimulator(options: StreamSimulatorOptions) {
  const [contentState, setContentState] = useState('')
  const [chunksState, setChunksState] = useState<ChunkInfo[]>([])
  const [isStreamingState, setIsStreamingState] = useState(false)
  const [isPausedState, setIsPausedState] = useState(false)
  const [lastDelayMsState, setLastDelayMsState] = useState(0)
  const [lastChunkSizeState, setLastChunkSizeState] = useState(0)
  const [chunkCountState, setChunkCountState] = useState(0)

  const contentRef = useRef(contentState)
  const chunksRef = useRef(chunksState)
  const isStreamingRef = useRef(isStreamingState)
  const isPausedRef = useRef(isPausedState)
  const lastDelayMsRef = useRef(lastDelayMsState)
  const lastChunkSizeRef = useRef(lastChunkSizeState)
  const chunkCountRef = useRef(chunkCountState)
  const optionsRef = useRef(options)
  const burstStateRef = useRef<BurstState>({
    quickChunksRemaining: 0,
    fastCadenceChunkPending: false,
  })
  const timerRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const setContent = useCallback((value: string) => {
    contentRef.current = value
    setContentState(value)
  }, [])

  const setChunks = useCallback((value: ChunkInfo[]) => {
    chunksRef.current = value
    setChunksState(value)
  }, [])

  const setIsStreaming = useCallback((value: boolean) => {
    isStreamingRef.current = value
    setIsStreamingState(value)
  }, [])

  const setIsPaused = useCallback((value: boolean) => {
    isPausedRef.current = value
    setIsPausedState(value)
  }, [])

  const setLastDelayMs = useCallback((value: number) => {
    lastDelayMsRef.current = value
    setLastDelayMsState(value)
  }, [])

  const setLastChunkSize = useCallback((value: number) => {
    lastChunkSizeRef.current = value
    setLastChunkSizeState(value)
  }, [])

  const setChunkCount = useCallback((value: number) => {
    chunkCountRef.current = value
    setChunkCountState(value)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearTimer()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsStreaming(false)
    setIsPaused(false)
  }, [clearTimer, setIsPaused, setIsStreaming])

  const scheduleNext = useCallback((isFirstChunk = false) => {
    const source = optionsRef.current.source || ''
    if (!isStreamingRef.current || isPausedRef.current)
      return

    if (contentRef.current.length >= source.length) {
      stop()
      return
    }

    const burstiness = normalizeRatio(Number(optionsRef.current.burstiness), 0.35)
    const pureRandom = (optionsRef.current.sliceMode ?? 'boundary-aware') === 'pure-random'
    const { min, max } = normalizeStreamRange(
      Number(optionsRef.current.chunkDelayMin),
      Number(optionsRef.current.chunkDelayMax),
      8,
      1800,
      16,
      40,
    )
    const delayMs = sampleDelayMsFromRange(
      min,
      max,
      burstiness,
      burstStateRef.current,
      isFirstChunk,
      pureRandom,
      optionsRef.current.random ?? Math.random,
    )

    setLastDelayMs(delayMs)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const sourceValue = optionsRef.current.source || ''
      if (!isStreamingRef.current || isPausedRef.current)
        return

      if (!sourceValue.length) {
        stop()
        return
      }

      const start = contentRef.current.length
      if (start >= sourceValue.length) {
        stop()
        return
      }

      const { min: chunkSizeMin, max: chunkSizeMax } = normalizeStreamRange(
        Number(optionsRef.current.chunkSizeMin),
        Number(optionsRef.current.chunkSizeMax),
        1,
        160,
        2,
        6,
      )
      const nextChunkSize = sampleChunkSizeFromRange(
        sourceValue,
        start,
        chunkSizeMin,
        chunkSizeMax,
        burstStateRef.current,
        optionsRef.current.sliceMode ?? 'boundary-aware',
        optionsRef.current.random ?? Math.random,
      )

      const nextChunk = sourceValue.slice(start, start + nextChunkSize)
      const nextCount = chunkCountRef.current + 1

      setLastChunkSize(nextChunkSize)
      setChunkCount(nextCount)
      setContent(sourceValue.slice(0, start + nextChunkSize))
      setChunks([
        ...chunksRef.current,
        {
          index: nextCount - 1,
          content: nextChunk,
          delay: lastDelayMsRef.current,
        },
      ])

      if (burstStateRef.current.fastCadenceChunkPending) {
        burstStateRef.current.fastCadenceChunkPending = false
        burstStateRef.current.quickChunksRemaining = Math.max(0, burstStateRef.current.quickChunksRemaining - 1)
      }

      if (contentRef.current.length >= sourceValue.length) {
        stop()
        return
      }

      scheduleNext()
    }, delayMs)
  }, [setChunkCount, setChunks, setContent, setLastChunkSize, setLastDelayMs, stop])

  const startReadableStream = useCallback(async (reset = true) => {
    clearTimer()
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller
    burstStateRef.current.quickChunksRemaining = 0
    burstStateRef.current.fastCadenceChunkPending = false

    if (reset)
      setContent('')

    setChunks([])
    setLastChunkSize(0)
    setLastDelayMs(0)
    setChunkCount(0)
    setIsPaused(false)

    const source = optionsRef.current.source || ''
    if (!source.length) {
      abortControllerRef.current = null
      setIsStreaming(false)
      return
    }

    const { min: chunkSizeMin, max: chunkSizeMax } = normalizeStreamRange(
      Number(optionsRef.current.chunkSizeMin),
      Number(optionsRef.current.chunkSizeMax),
      1,
      160,
      2,
      6,
    )
    const { min: chunkDelayMin, max: chunkDelayMax } = normalizeStreamRange(
      Number(optionsRef.current.chunkDelayMin),
      Number(optionsRef.current.chunkDelayMax),
      8,
      1800,
      16,
      40,
    )

    setIsStreaming(true)

    try {
      const stream = createLocalTextStream(source, {
        chunkDelayMax,
        chunkDelayMin,
        chunkSizeMax,
        chunkSizeMin,
        random: optionsRef.current.random,
        sliceMode: optionsRef.current.sliceMode ?? 'boundary-aware',
        control: {
          shouldPause: () => isPausedRef.current,
          signal: controller.signal,
        },
        onChunk: (chunk) => {
          const nextCount = chunkCountRef.current + 1
          setLastDelayMs(chunk.delay)
          setLastChunkSize(chunk.content.length)
          setChunkCount(nextCount)
          setChunks([...chunksRef.current, chunk])
        },
      })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let accumulated = reset ? '' : contentRef.current

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done)
          break

        accumulated += decoder.decode(value, { stream: true })
        setContent(accumulated)
      }
    }
    finally {
      if (abortControllerRef.current === controller)
        abortControllerRef.current = null

      if (abortControllerRef.current === null || abortControllerRef.current === controller) {
        setIsStreaming(false)
        setIsPaused(false)
      }
    }
  }, [clearTimer, setChunkCount, setChunks, setContent, setIsPaused, setIsStreaming, setLastChunkSize, setLastDelayMs])

  const start = useCallback((reset = true) => {
    const source = optionsRef.current.source || ''
    if (!source.length) {
      setLastChunkSize(0)
      setLastDelayMs(0)
      setIsStreaming(false)
      setIsPaused(false)
      return
    }

    const transportMode = optionsRef.current.transportMode ?? 'scheduler'
    if (transportMode === 'readable-stream') {
      void startReadableStream(reset)
      return
    }

    clearTimer()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    burstStateRef.current.quickChunksRemaining = 0
    burstStateRef.current.fastCadenceChunkPending = false

    if (reset)
      setContent('')

    setChunks([])
    setLastChunkSize(0)
    setLastDelayMs(0)
    setChunkCount(0)
    setIsStreaming(true)
    setIsPaused(false)
    scheduleNext(true)
  }, [clearTimer, scheduleNext, setChunkCount, setChunks, setContent, setIsPaused, setIsStreaming, setLastChunkSize, setLastDelayMs, startReadableStream])

  const pause = useCallback(() => {
    if (!isStreamingRef.current)
      return
    setIsPaused(true)
    clearTimer()
  }, [clearTimer, setIsPaused])

  const resume = useCallback(() => {
    if (!isStreamingRef.current || !isPausedRef.current)
      return
    setIsPaused(false)
    if ((optionsRef.current.transportMode ?? 'scheduler') === 'scheduler')
      scheduleNext()
  }, [scheduleNext, setIsPaused])

  const togglePause = useCallback(() => {
    if (isPausedRef.current)
      resume()
    else
      pause()
  }, [pause, resume])

  const reset = useCallback(() => {
    stop()
    setContent('')
    setChunks([])
    setChunkCount(0)
    setLastChunkSize(0)
    setLastDelayMs(0)
    burstStateRef.current.quickChunksRemaining = 0
    burstStateRef.current.fastCadenceChunkPending = false
  }, [setChunkCount, setChunks, setContent, setLastChunkSize, setLastDelayMs, stop])

  useEffect(() => () => {
    stop()
  }, [stop])

  return {
    chunkCount: chunkCountState,
    chunks: chunksState,
    content: contentState,
    isPaused: isPausedState,
    isStreaming: isStreamingState,
    lastChunkSize: lastChunkSizeState,
    lastDelayMs: lastDelayMsState,
    pause,
    reset,
    resume,
    start,
    stop,
    togglePause,
  }
}
