import AbstractFifoSamplePipe from './pipe.js'

export default class RateTransposer extends AbstractFifoSamplePipe {
  constructor (createBuffers) {
    super(createBuffers)
    this.slopeCount = 0
    this.prevSampleL = 0
    this.prevSampleR = 0
    this.rate = 1
  }

  set rate (rate) {
    this._rate = rate
  }

  _reset () {
    this.slopeCount = 0
    this.prevSampleL = 0
    this.prevSampleR = 0
  }

  clone () {
    const result = new RateTransposer()
    result.rate = this._rate
    return result
  }

  process () {
    const numFrames = this._inputBuffer.frameCount
    this._outputBuffer.ensureAdditionalCapacity(numFrames / this._rate + 1)
    const numFramesOutput = this._transpose(numFrames)
    this._inputBuffer.receive()
    this._outputBuffer.put(numFramesOutput)
  }

  _transpose (numFrames) {
    if (numFrames == 0) {
      return 0
    }

    const src = this._inputBuffer.vector
    const srcOffset = this._inputBuffer.startIndex

    const dest = this._outputBuffer.vector
    const destOffset = this._outputBuffer.endIndex

    let used = 0
    let i = 0

    while(this.slopeCount < 1.0) {
      dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * this.prevSampleL + this.slopeCount * src[srcOffset]
      dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * this.prevSampleR + this.slopeCount * src[srcOffset + 1]
      i++
      this.slopeCount += this._rate
    }

    this.slopeCount -= 1.0

    if (numFrames != 1) {
      out: while (true) {
        while (this.slopeCount > 1.0) {
          this.slopeCount -= 1.0
          used++
          if (used >= numFrames - 1) {
            break out
          }
        }

        const srcIndex = srcOffset + 2 * used
        dest[destOffset + 2 * i] = (1.0 - this.slopeCount) * src[srcIndex] + this.slopeCount * src[srcIndex + 2]
        dest[destOffset + 2 * i + 1] = (1.0 - this.slopeCount) * src[srcIndex + 1] + this.slopeCount * src[srcIndex + 3]

        i++
        this.slopeCount += this._rate
      }
    }

    this.prevSampleL = src[srcOffset + 2 * numFrames - 2]
    this.prevSampleR = src[srcOffset + 2 * numFrames - 1]

    return i
  }
}