import AbstractFifoSamplePipe from './pipe.js'

/**
* Giving this value for the sequence length sets automatic parameter value
* according to tempo setting (recommended)
*/
const USE_AUTO_SEQUENCE_LEN = 0

/**
* Default length of a single processing sequence, in milliseconds. This determines to how
* long sequences the original sound is chopped in the time-stretch algorithm.
*
* The larger this value is, the lesser sequences are used in processing. In principle
* a bigger value sounds better when slowing down tempo, but worse when increasing tempo
* and vice versa.
*
* Increasing this value reduces computational burden and vice versa.
*/
//var DEFAULT_SEQUENCE_MS = 130
const DEFAULT_SEQUENCE_MS = USE_AUTO_SEQUENCE_LEN

/**
* Giving this value for the seek window length sets automatic parameter value
* according to tempo setting (recommended)
*/
const USE_AUTO_SEEKWINDOW_LEN = 0

/**
* Seeking window default length in milliseconds for algorithm that finds the best possible
* overlapping location. This determines from how wide window the algorithm may look for an
* optimal joining location when mixing the sound sequences back together.
*
* The bigger this window setting is, the higher the possibility to find a better mixing
* position will become, but at the same time large values may cause a "drifting" artifact
* because consequent sequences will be taken at more uneven intervals.
*
* If there's a disturbing artifact that sounds as if a constant frequency was drifting
* around, try reducing this setting.
*
* Increasing this value increases computational burden and vice versa.
*/
//var DEFAULT_SEEKWINDOW_MS = 25
const DEFAULT_SEEKWINDOW_MS = USE_AUTO_SEEKWINDOW_LEN

/**
* Overlap length in milliseconds. When the chopped sound sequences are mixed back together,
* to form a continuous sound stream, this parameter defines over how long period the two
* consecutive sequences are let to overlap each other.
*
* This shouldn't be that critical parameter. If you reduce the DEFAULT_SEQUENCE_MS setting
* by a large amount, you might wish to try a smaller value on this.
*
* Increasing this value increases computational burden and vice versa.
*/
const DEFAULT_OVERLAP_MS = 8

// Table for the hierarchical mixing position seeking algorithm
const _SCAN_OFFSETS = [
    [ 124,  186,  248,  310,  372,  434,  496,  558,  620,  682,  744, 806,
      868,  930,  992, 1054, 1116, 1178, 1240, 1302, 1364, 1426, 1488,   0],
    [-100,  -75,  -50,  -25,   25,   50,   75,  100,    0,    0,    0,   0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,   0],
    [ -20,  -15,  -10,   -5,    5,   10,   15,   20,    0,    0,    0,   0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,   0],
    [  -4,   -3,   -2,   -1,    1,    2,    3,    4,    0,    0,    0,   0,
        0,    0,    0,    0,    0,    0,    0,    0,    0,    0,    0,   0]]

// Adjust tempo param according to tempo, so that variating processing sequence length is used
// at varius tempo settings, between the given low...top limits
const AUTOSEQ_TEMPO_LOW = 0.5     // auto setting low tempo range (-50%)
const AUTOSEQ_TEMPO_TOP = 2.0     // auto setting top tempo range (+100%)

// sequence-ms setting values at above low & top tempo
const AUTOSEQ_AT_MIN = 125.0
const AUTOSEQ_AT_MAX = 50.0
const AUTOSEQ_K = ((AUTOSEQ_AT_MAX - AUTOSEQ_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW))
const AUTOSEQ_C = (AUTOSEQ_AT_MIN - (AUTOSEQ_K) * (AUTOSEQ_TEMPO_LOW))

// seek-window-ms setting values at above low & top tempo
const AUTOSEEK_AT_MIN = 25.0
const AUTOSEEK_AT_MAX = 15.0
const AUTOSEEK_K = ((AUTOSEEK_AT_MAX - AUTOSEEK_AT_MIN) / (AUTOSEQ_TEMPO_TOP - AUTOSEQ_TEMPO_LOW))
const AUTOSEEK_C = (AUTOSEEK_AT_MIN - (AUTOSEEK_K) * (AUTOSEQ_TEMPO_LOW))


export default class Stretch extends AbstractFifoSamplePipe {
  constructor (createBuffers) {
    super(createBuffers)
    this.bQuickSeek = true
    this.bMidBufferDirty = false

    this.pMidBuffer = null
    this.overlapLength = 0

    this.bAutoSeqSetting = true
    this.bAutoSeekSetting = true

    this._tempo = 1
    this.setParameters(44100, DEFAULT_SEQUENCE_MS, DEFAULT_SEEKWINDOW_MS, DEFAULT_OVERLAP_MS)
  }

  get tempo () {
    return this._tempo
  }

  /**
  * Sets new target tempo. Normal tempo = 'SCALE', smaller values represent slower
  * tempo, larger faster tempo.
  */
  set tempo (newTempo) {
    this._tempo = newTempo

    // Calculate new sequence duration
    this.calcSeqParameters()

    // Calculate ideal skip length (according to tempo value)
    this.nominalSkip = this._tempo * (this.seekWindowLength - this.overlapLength)
    this.skipFract = 0
    const intskip = Math.floor(this.nominalSkip + 0.5)

    // Calculate how many samples are needed in the 'inputBuffer' to
    // process another batch of samples
    this.sampleReq = Math.max(intskip + this.overlapLength, this.seekWindowLength) + this.seekLength
  }

  get inputChunkSize () {
    return this.sampleReq
  }

  get outputChunkSize () {
    return this.overlapLength + Math.max(0, this.seekWindowLength - 2 * this.overlapLength)
  }

  /**
  * Enables/disables the quick position seeking algorithm.
  */
  set quickSeek (enable) {
    this.bQuickSeek = enable
  }
  
  clear () {
    super.clear()
    this._clearMidBuffer()
  }

  _clearMidBuffer () {
    if (this.bMidBufferDirty) {
      this.bMidBufferDirty = false
      this.pMidBuffer = null
    }
  }

  /**
    * Sets routine control parameters. These control are certain time constants
    * defining how the sound is stretched to the desired duration.
    *
    * 'sampleRate' = sample rate of the sound
    * 'sequenceMS' = one processing sequence length in milliseconds (default = 82 ms)
    * 'seekwindowMS' = seeking window length for scanning the best overlapping
    *      position (default = 28 ms)
    * 'overlapMS' = overlapping length (default = 12 ms)
    */
  setParameters (aSampleRate, aSequenceMS, aSeekWindowMS, aOverlapMS) {
    // accept only positive parameter values - if zero or negative, use old values instead
    if (aSampleRate > 0) {
      this.sampleRate = aSampleRate
    }
    if (aOverlapMS > 0) {
      this.overlapMs = aOverlapMS
    }

    if (aSequenceMS > 0) {
      this.sequenceMs = aSequenceMS
      this.bAutoSeqSetting = false
    } else {
      // zero or below, use automatic setting
      this.bAutoSeqSetting = true
    }

    if (aSeekWindowMS > 0) {
      this.seekWindowMs = aSeekWindowMS
      this.bAutoSeekSetting = false
    } else {
      // zero or below, use automatic setting
      this.bAutoSeekSetting = true
    }

    this.calcSeqParameters()

    this.calculateOverlapLength(this.overlapMs)

    // set tempo to recalculate 'sampleReq'
    this.tempo = this._tempo
  }

  /**
  * Calculates overlapInMsec period length in samples.
  */
  calculateOverlapLength (overlapInMsec) {
    let newOvl

    // TODO assert(overlapInMsec >= 0)
    newOvl = (this.sampleRate * overlapInMsec) / 1000
    if (newOvl < 16) newOvl = 16

    // must be divisible by 8
    newOvl -= newOvl % 8

    this.overlapLength = newOvl

    this.pRefMidBuffer = new Float32Array(this.overlapLength * 2)
    this.pMidBuffer = new Float32Array(this.overlapLength * 2)
  }

  checkLimits (x, mi, ma) {
    return (x < mi) ? mi : ((x > ma) ? ma : x)
  }

  /**
  * Calculates processing sequence length according to tempo setting
  */
  calcSeqParameters () {
    let seq, seek

    if (this.bAutoSeqSetting) {
      seq = AUTOSEQ_C + AUTOSEQ_K * this._tempo
      seq = this.checkLimits(seq, AUTOSEQ_AT_MAX, AUTOSEQ_AT_MIN)
      this.sequenceMs = Math.floor(seq + 0.5)
    }

    if (this.bAutoSeekSetting) {
      seek = AUTOSEEK_C + AUTOSEEK_K * this._tempo
      seek = this.checkLimits(seek, AUTOSEEK_AT_MAX, AUTOSEEK_AT_MIN)
      this.seekWindowMs = Math.floor(seek + 0.5)
    }

    // Update seek window lengths
    this.seekWindowLength = Math.floor((this.sampleRate * this.sequenceMs) / 1000)
    this.seekLength = Math.floor((this.sampleRate * this.seekWindowMs) / 1000)
  }

  clone () {
    const result = new Stretch()
    result.tempo = this.tempo
    result.setParameters(this.sampleRate, this.sequenceMs, this.seekWindowMs, this.overlapMs)
    return result
  }

  /**
  * Seeks for the optimal overlap-mixing position.
  */
  seekBestOverlapPosition () {
    return this.bQuickSeek
      ? this.seekBestOverlapPositionStereoQuick()
      : this.seekBestOverlapPositionStereo()
  }

  /**
  * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
  * routine
  *
  * The best position is determined as the position where the two overlapped
  * sample sequences are 'most alike', in terms of the highest cross-correlation
  * value over the overlapping period
  */
  seekBestOverlapPositionStereo () {
    // Slopes the amplitudes of the 'midBuffer' samples
    this.precalcCorrReferenceStereo()

    let bestCorr = Number.MIN_VALUE
    let bestOffs = 0

    // Scans for the best correlation value by testing each possible position
    // over the permitted range.
    for (let i = 0; i < this.seekLength; i ++) {
      // Calculates correlation value for the mixing position corresponding
      // to 'i'
      const corr = this.calcCrossCorrStereo(2 * i, this.pRefMidBuffer)

      // Checks for the highest correlation value
      if (corr > bestCorr) {
        bestCorr = corr
        bestOffs = i
      }
    }

    return bestOffs
  }

  /**
  * Seeks for the optimal overlap-mixing position. The 'stereo' version of the
  * routine
  *
  * The best position is determined as the position where the two overlapped
  * sample sequences are 'most alike', in terms of the highest cross-correlation
  * value over the overlapping period
  */
  seekBestOverlapPositionStereoQuick () {
    // Slopes the amplitude of the 'midBuffer' samples
    this.precalcCorrReferenceStereo()

    let bestCorr = Number.MIN_VALUE
    let bestOffs = 0
    let corrOffset = 0
    let tempOffset = 0

    // Scans for the best correlation value using four-pass hierarchical search.
    //
    // The look-up table 'scans' has hierarchical position adjusting steps.
    // In first pass the routine searhes for the highest correlation with
    // relatively coarse steps, then rescans the neighbourhood of the highest
    // correlation with better resolution and so on.
    for (let scanCount = 0; scanCount < 4; scanCount ++) {
      let j = 0
      while (_SCAN_OFFSETS[scanCount][j]) {
        tempOffset = corrOffset + _SCAN_OFFSETS[scanCount][j]
        if (tempOffset >= this.seekLength) break

        // Calculates correlation value for the mixing position corresponding
        // to 'tempOffset'
        const corr = this.calcCrossCorrStereo(2 * tempOffset, this.pRefMidBuffer)

        // Checks for the highest correlation value
        if (corr > bestCorr) {
          bestCorr = corr
          bestOffs = tempOffset
        }
        j++
      }
      corrOffset = bestOffs
    }

    return bestOffs
  }

  /**
  * Slopes the amplitude of the 'midBuffer' samples so that cross correlation
  * is faster to calculate
  */
  precalcCorrReferenceStereo () {
    for (let i = 0; i < this.overlapLength; i ++) {
      const temp = i * (this.overlapLength - i)
      const cnt2 = i * 2
      this.pRefMidBuffer[cnt2] = this.pMidBuffer[cnt2] * temp
      this.pRefMidBuffer[cnt2 + 1] = this.pMidBuffer[cnt2 + 1] * temp
    }
  }

  calcCrossCorrStereo (mixingPos, compare) {
    const mixing = this._inputBuffer.vector
    mixingPos += this._inputBuffer.startIndex

    let corr = 0

    for (let i = 2; i < 2 * this.overlapLength; i += 2) {
      const mixingOffset = i + mixingPos
      corr += mixing[mixingOffset] * compare[i] +
      mixing[mixingOffset + 1] * compare[i + 1]
    }

    return corr
  }

  // TODO inline
  /**
  * Overlaps samples in 'midBuffer' with the samples in 'pInputBuffer' at position
  * of 'ovlPos'.
  */
  overlap (ovlPos) {
    this.overlapStereo(2 * ovlPos)
  }

  /**
  * Overlaps samples in 'midBuffer' with the samples in 'pInput'
  */
  overlapStereo (pInputPos) {
    const pInput = this._inputBuffer.vector
    pInputPos += this._inputBuffer.startIndex

    const pOutput = this._outputBuffer.vector
    const pOutputPos = this._outputBuffer.endIndex

    const fScale = 1 / this.overlapLength

    for (let i = 0; i < this.overlapLength; i++) {
      const fTemp = (this.overlapLength - i) * fScale
      const fi = i * fScale
      const cnt2 = 2 * i
      const pInputOffset = cnt2 + pInputPos
      const pOutputOffset = cnt2 + pOutputPos

      pOutput[pOutputOffset + 0] = pInput[pInputOffset + 0] * fi + this.pMidBuffer[cnt2 + 0] * fTemp
      pOutput[pOutputOffset + 1] = pInput[pInputOffset + 1] * fi + this.pMidBuffer[cnt2 + 1] * fTemp
    }
  }

  process () {
    if (this.pMidBuffer == null) {
      // if midBuffer is empty, move the first samples of the input stream
      // into it
      if (this._inputBuffer.frameCount < this.overlapLength) {
        // wait until we've got overlapLength samples
        return
      }
      this.pMidBuffer = new Float32Array(this.overlapLength * 2)
      this._inputBuffer.receiveSamples(this.pMidBuffer, this.overlapLength)
    }

    // Process samples as long as there are enough samples in 'inputBuffer'
    // to form a processing frame.
    while (this._inputBuffer.frameCount >= this.sampleReq) {
      // If tempo differs from the normal ('SCALE'), scan for the best overlapping
      // position
      const offset = this.seekBestOverlapPosition()

      // Mix the samples in the 'inputBuffer' at position of 'offset' with the
      // samples in 'midBuffer' using sliding overlapping
      // ... first partially overlap with the end of the previous sequence
      // (that's in 'midBuffer')
      this._outputBuffer.ensureAdditionalCapacity(this.overlapLength)
      // FIXME unit?
      //overlap(uint(offset))
      this.overlap(Math.floor(offset))
      this._outputBuffer.put(this.overlapLength)

      // ... then copy sequence samples from 'inputBuffer' to output
      const temp = (this.seekWindowLength - 2 * this.overlapLength) // & 0xfffffffe
      if (temp > 0) {
        this._outputBuffer.putBuffer(this._inputBuffer, offset + this.overlapLength, temp)
      }

      // Copies the end of the current sequence from 'inputBuffer' to
      // 'midBuffer' for being mixed with the beginning of the next
      // processing sequence and so on
      //assert(offset + seekWindowLength <= (int)inputBuffer.numSamples())
      const start = this.inputBuffer.startIndex + 2 * (offset + this.seekWindowLength - this.overlapLength)
      this.pMidBuffer.set(this._inputBuffer.vector.subarray(start, start + 2 * this.overlapLength))

      // Remove the processed samples from the input buffer. Update
      // the difference between integer & nominal skip step to 'skipFract'
      // in order to prevent the error from accumulating over time.
      this.skipFract += this.nominalSkip   // real skip size
      const ovlSkip = Math.floor(this.skipFract) // rounded to integer skip
      this.skipFract -= ovlSkip            // maintain the fraction part, i.e. real vs. integer skip
      this._inputBuffer.receive(ovlSkip)
    }
  }
}