# MediaGarrd

MediaGarrd creates scheduled backups for commonly self-hosted services and provides a simple client UI to manage backups.

See all supported services [here](https://github.com/MediaGarrd/Server/blob/main/ref/SUPPORTED_SERVICES)

## Structure
MediaGarrd is split into two containers: Server and Client:
- The server can be found [here](https://github.com/MediaGarrd/Server). It handles generating the backups at the configured interval
- The client can be found [here](https://github.com/MediaGarrd/Client). It handles downloading the latest backups at the configured interval

## Contributing
For a detailed guide on how to contribute, see [here](./CONTRIBUTING.md)
