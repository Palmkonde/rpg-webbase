// A Map file the server no longer holds, carrying the status so the Host can tell a pruned World Version from a broken one.
export class MapFileError extends Error {
  public readonly status: number

  public constructor(tiledMapUrl: string, status: number) {
    super(`The Map ${tiledMapUrl} answered ${status}`)
    this.name = 'MapFileError'
    this.status = status
  }
}
