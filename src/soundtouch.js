import Stretch from './stretch.js'
import FifoSampleBuffer from './buffer.js'
import RateTransposer from './rate-transposer.js'

const testFloatEqual = (a, b) => {
  return (a > b ? a - b : b - a) > 1e-10
}

export default class SoundTouch {
  constructor () {
    this.rateTransposer = new RateTransposer(false)
    this.tdStretch = new Stretch(false)

    this._inputBuffer = new FifoSampleBuffer()
    this._intermediateBuffer = new FifoSampleBuffer()
    this._outputBuffer = new FifoSampleBuffer()

    this._rate = 0
    this.tempo = 0

    this.virtualPitch = 1.0
    this.virtualRate = 1.0
    this.virtualTempo = 1.0

    this._calculateEffectiveRateAndTempo()
  }

  get rate () {
    return this._rate
  }

  set rate (rate) {
    this.virtualRate = rate
    this._calculateEffectiveRateAndTempo()
  }

  set rateChange (rateChange) {
    this.rate = 1.0 + 0.01 * rateChange
  }

  get tempo () {
    return this._tempo
  }

  set tempo (tempo) {
    this.virtualTempo = tempo
    this._calculateEffectiveRateAndTempo()
  }

  set tempoChange (tempoChange) {
    this.tempo = 1.0 + 0.01 * tempoChange
  }

  get pitch () {
    return this.virtualPitch
  }

  set pitch (pitch) {
    this.virtualPitch = pitch
    this._calculateEffectiveRateAndTempo()
  }

  set pitchOctaves (pitchOctaves) {
    this.pitch = Math.exp(0.69314718056 * pitchOctaves)
    this._calculateEffectiveRateAndTempo()
  }

  set pitchSemitones (pitchSemitones) {
    this.pitchOctaves = pitchSemitones / 12.0
  }

  get inputBuffer () {
    return this._inputBuffer
  }

  get outputBuffer () {
    return this._outputBuffer
  }

  clear () {
    this.rateTransposer.clear()
    this.tdStretch.clear()
  }

  clone () {
    const result = new SoundTouch()
    result.rate = rate
    result.tempo = tempo
    return result
  }

  process () {
    if (this._rate > 1.0) {
      this.tdStretch.process()
      this.rateTransposer.process()
    } else {
      this.rateTransposer.process()
      this.tdStretch.process()
    }
  }

  _calculateEffectiveRateAndTempo () {
    console.log("calculating")
    const previousTempo = this._tempo
    const previousRate = this._rate

    this._tempo = this.virtualTempo / this.virtualPitch
    this._rate = this.virtualRate * this.virtualPitch

    if (testFloatEqual(this._tempo, previousTempo)) {
      this.tdStretch.tempo = this._tempo
    }
    if (testFloatEqual(this._rate, previousRate)) {
      this.rateTransposer.rate = this._rate
    }

    if (this._rate > 1.0) {
      if (this._outputBuffer != this.rateTransposer.outputBuffer) {
        this.tdStretch.inputBuffer = this._inputBuffer
        this.tdStretch.outputBuffer = this._intermediateBuffer

        this.rateTransposer.inputBuffer = this._intermediateBuffer
        this.rateTransposer.outputBuffer = this._outputBuffer
      }
    } else {
      if (this._outputBuffer != this.tdStretch.outputBuffer) {
        this.rateTransposer.inputBuffer = this._inputBuffer
        this.rateTransposer.outputBuffer = this._intermediateBuffer

        this.tdStretch.inputBuffer = this._intermediateBuffer
        this.tdStretch.outputBuffer = this._outputBuffer
      }
    }
  }
}