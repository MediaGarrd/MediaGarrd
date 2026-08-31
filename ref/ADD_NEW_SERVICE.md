# Adding a new service

When adding a new service to the project, doing the following will make it easy:
```bash
rg //@ADD_NEW_SERVICE
```
in the repository root to identify the files that require changes to support a new service. These files will always require modification when adding a new service, but there may be more to do depending on the implementation.
