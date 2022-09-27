# oci-revision-tagger-action
Github Action that adds a revision tag to images in a container registry

## Background

Docker tags are by design mutable and most images in a registry will periodically be updated while still retaining the
same image tag. The update is normally triggered either by updates to the base image or a new version of the image
application. 

In Kubernetes, an image tag should be considered immutable and should never change and this means that an mutable tags
in a container registry should never be used when deploying in kubernetes.

This action attempts to bridge the gap between docker images and kubernetes by providing a way to ensure that each
update to an image will always be accompanied with an immutable revision tag that is designed to be used when 
deploying the image. This is the same concept that debian are using for their packages where the package version is
a combination of the upstream application version and the package revision.

When using the revision tag in combination with a Continuous Delivery tool like fluxcd, we can ensure that a running
container is always updated when the image is updated and still uses a immutable tag.

## Strategy

The proposed strategy is a multi-step process:

* The first step is to make sure that the image is rebuilt on schedule,
say once a day to pickup changes to your base image. Naturally, the image is also built when pushing changes 
to your code repository (or tagging a new version) resulting in a new application version. 

* The build process must supports reproducible builds so rebuild with the same source and base image must produce the same digest.

* Start the build by determine any existing digest for the given version and save it for later use. This can be accomplished with the [oci-digest-action] action.

* Build the image as normal. If something has changed, the image will have a new digest. If the application has changed, the version tag should be updated as in a normal release. If only the base image has been changed, the version tag should be updated to reflect the new digest, just like a normal mutable tag.

* Use this action to add a revision tag for the given version. If the digest has changed or a revision tag is lacking, a new revision tag is created for the updated digest in a way that should be comparable to be considered *later* version than any existing revision for the same version. If the digest has not changed, this action does nothing.

For example:

The application releases a new version, say `1.0.0`. The workflow builds a new image and tags the digest with 
`1.0.0` and since there is no revision for the version, a new revision `1.0.0-1` is also created. When rebuilding on schedule the next day, there is no changes so no tags are altered or created. The day after, a new scheduled rebuild has an updated base image but the application version is unchanged. The newly built image will have a new digest and the version tag is updated to reflect the new digest. The revision will be incremented and a new revision tag `1.0.0-2` will be created for the new digest. The old revision still exists and still reflect the old version. Since the revision `1.0.0-2` is considered *higher* than `1.0.0-1`, the CD pipeline will update the running container with the new revision as expected. 

With the strategy outlined above, the revision tag will be treated as an immutable tag that satisfy Kubernetes and will never change once created. The version tag however, is a mutable tag that will be always be updated to reflect the latest revision of the same version.

## Inputs

### `image`

**Required** The image to retrieve the digest for.

### `digest`

**Required** The digest of the given image or empty if the current version does not exists.

### `strategy`

The revision strategy to use. Valid values are `alphabetical:PADDING` or `numerical`. The numerical strategy will create a new revision by appending the revision number as a last part of the revision. creating a revision like 
`1.0.0-1` and the 10:th revision will be `1.0.0-10`. The alphabetical strategy requires a padding parameter that is used to pad the revision to ensure that the revision can be alphabetical compared when selecting the *latest* revision. For example, when using strategy `alphabetical:3`, the revision for version `1.0.0` will be `1.0.0-001` and the 10:th revision will be `1.0.0-010`. If no alphabetical padding is specified, 3 will be used. Default strategy is `numerical.

### `os`

The OS to use instead of the running OS for choosing images.

### `arch`

The ARCH to use instead of the architecture of the machine for choosing images.

### `variant`

The VARIANT to use instead of the running architecture variant for choosing images.

## Outputs

### `revision`

The new revision tag or empty if no new revision was created'

## Example usage for a single image

```
uses: polagoab/oci-revision-tagger-action@v1
with:
  image: 'ubuntu:latest'
  digest: 'sha256:42'
```
