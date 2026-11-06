# Changesets

Each pull request that changes a package adds a changeset: run `bun run changeset`, pick the packages, the
bump (patch, minor or major) and write one line for the changelog. Merging to `main` opens or updates the
"Release packages" pull request; merging that one publishes. See the root README's Releasing section.
