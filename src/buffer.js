export default class FifoSampleBuffer {
  constructor () {
    this._vector = new Float32Array()
    this._position = 0
    this._frameCount = 0
  }

  get vector () {
    return this._vector
  }

  get position () {
    return this._position
  }

  get frameCount () {
    return this._frameCount
  }

  get startIndex () {
    return this._position * 2
  }
  
  get endIndex () {
    return (this.position + this.frameCount) * 2
  }

  clear (frameCount) {
    this.receive(frameCount)
    this.rewind()
  }

  put (numFrames) {
    this._frameCount += numFrames
  }

  putSamples (samples, position = 0, numFrames) {
    const sourceOffset = position * 2
    if (!(numFrames >= 0)) {
      numFrames = (samples.length - sourceOffset) / 2
    }
    const numSamples = numFrames * 2

    this.ensureCapacity(numFrames + this._frameCount)

    const destOffset = this.endIndex

    this._vector.set(samples.subarray(sourceOffset, sourceOffset + numSamples), destOffset)
    this._frameCount += numFrames
  }

  putBuffer (buffer, position = 0, numFrames) {
    if (!(numFrames >= 0)) {
      numFrames = buffer.frameCount - position
    }
    this.putSamples(buffer.vector, buffer.position + position, numFrames)
  }

  receive (numFrames) {
    if (!(numFrames >= 0) || numFrames > this._frameCount) {
      numFrames = this._frameCount
    }
    this._frameCount -= numFrames
    this._position += numFrames
  }

  receiveSamples (output, numFrames) {
    const numSamples = numFrames * 2
    const sourceOffset = this.startIndex
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples))
    this.receive(numFrames)
  }

  extract (output, position, numFrames) {
    const sourceOffset = this.startIndex + position * 2
    const numSamples = numFrames * 2
    output.set(this._vector.subarray(sourceOffset, sourceOffset + numSamples))
  }

  ensureCapacity (numFrames) {
    const minLength = numFrames * 2
    if (this._vector.length < minLength) {
      const newVector = new Float32Array(minLength)
      newVector.set(this._vector.subarray(this.startIndex, this.endIndex))
      this._vector = newVector
      this._position = 0
    } else {
      this.rewind()
    }
  }

  ensureAdditionalCapacity (numFrames) {
    this.ensureCapacity(this.frameCount + numFrames)
  }

  rewind () {
    if (this._position > 0) {
      this._vector.set(this._vector.subarray(this.startIndex, this.endIndex))
      this._position = 0
    }
  }
}