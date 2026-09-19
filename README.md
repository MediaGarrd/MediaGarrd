# MediaGarrd

MediaGarrd creates scheduled backups for commonly self-hosted services and provides a simple client UI to manage backups.

## Structure
MediaGarrd is split into two containers - Server and Client:
- The server can be found [here](https://github.com/MediaGarrd/Server). It handles generating the backups at the configured interval
- The client can be found [here](https://github.com/MediaGarrd/Client). It handles downloading the latest backups at the configured interval

## Support Services
All supported services can be found [here](https://github.com/MediaGarrd/Server/blob/main/ref/SUPPORTED_SERVICES). If a service you use is missing, feel free to open an issue [here](https://github.com/MediaGarrd/Server/issues).
