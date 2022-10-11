/*
 * Copyright 2022 Polago AB.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const { RunOptions, RunTarget } = require('github-action-ts-run-api');

const child_process = require('child_process')
jest.mock("child_process")
jest.setTimeout(100000)

const runAction = require('../src/action');
const { version } = require('os');

describe(`Single image tests`, () => {
    const digest = 'sha256:42'
    const image = 'unknown-image:1.0.0'
    const revision = '1.0.0-1'
    const revision2 = '1.0.0-2'
    const revisionImage = 'unknown-image:1.0.0-1'
    const revisionImage2 = 'unknown-image:1.0.0-2'

    beforeEach(() => {
        jest.resetModules();
    });

    test("Single image with no input digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: undefined })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
                callback(null, { stdout: digest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://" + image.split(':')[0])
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create " + image + " --tag " + revisionImage)
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
        expect(result.commands.outputs.revision).toBe(revision)
    })

    test("Single image with no input digest and alphabetical strategy", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: undefined, strategy: 'alphabetical' })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
                callback(null, { stdout: digest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://" + image.split(':')[0])
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create " + image + " --tag " + image + "-001")
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
        expect(result.commands.outputs.revision).toBe("1.0.0-001")
    })

    test("Single image with no input digest and alphabetical:2 strategy", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: undefined, strategy: 'alphabetical:2' })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
                callback(null, { stdout: digest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://" + image.split(':')[0])
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create " + image + " --tag " + image + "-01")
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
        expect(result.commands.outputs.revision).toBe("1.0.0-01")
    })

    test("Single image with no input digest and no existing digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: undefined })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo inspec --format '{{.Digest}}' docker://" + image)
            callback(null, { stdout: '' });
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBe(false)
    })


    test("Single image with unchanged digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
                callback(null, { stdout: digest });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
        expect(result.commands.outputs.revision).toBeUndefined()
    })

    test("Single image with updated digest", async () => {
        const updatedDigest = 'sha256:43'
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
                callback(null, { stdout: updatedDigest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://" + image.split(':')[0])
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0', '1.0.0-001'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create " + image + " --tag " + revisionImage2)
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(updatedDigest)
        expect(result.commands.outputs.revision).toBe(revision2)
    })

    test("Single image with os input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest, os: 'linux' })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo --override-os=linux inspect')) {
                callback(null, { stdout: digest });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with arch input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest, arch: 'x86' })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo --override-arch=x86 inspect')) {
                callback(null, { stdout: digest });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with variant input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest, variant: 'v6' })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo --override-variant=v6 inspect')) {
                callback(null, { stdout: digest });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.digest).toBe(digest)
    })
})

describe(`Multiple images tests`, () => {
    const digest1 = 'sha256:42'
    const image1 = 'unknown-image:1.0.0'
    const revision1 = '1.0.0-1'
    const newDigest1 = 'sha256:44'

    const digest2 = 'sha256:43'
    const image2 = 'another-unknown-image:2.0.0'
    const revision2 = '2.0.0-1'
    const newDigest2 = 'sha256:45'

    test("Multiple images with no input digests", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: JSON.stringify([image1, image2]), digest: undefined })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                if (command.includes(image1)) {
                    callback(null, { stdout: digest1 });
                } else if (command.includes(image2)) {
                    callback(null, { stdout: digest2 });
                } else {
                    throw new Error("Unrecognized skopeo inspect call: " + command)
                }

            } else if (command.includes('skopeo list-tags')) {
                if (command.includes('docker://' + image1.split(':')[0])) {
                    callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0'] }) });
                } else if (command.includes('docker://' + image2.split(':')[0])) {
                    callback(null, { stdout: JSON.stringify({ Tags: ['2.0.0'] }) });
                } else {
                    throw new Error("Unrecognized skopeo list-tags call: " + command)
                }
            } else if (command.includes('docker buildx imagetools create')) {
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()

        const revisions = JSON.parse(result.commands.outputs.revision)
        expect(revisions.length).toBe(2)
        expect(revisions[0]).toBe(revision1)
        expect(revisions[1]).toBe(revision2)

        const digests = JSON.parse(result.commands.outputs.digest)
        expect(digests.length).toBe(2)
        expect(digests[0]).toBe(digest1)
        expect(digests[1]).toBe(digest2)
    })

    test("Multiple images with all unchanged digests", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: JSON.stringify([image1, image2]), digest: JSON.stringify([digest1, digest2]) })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                if (command.includes(image1)) {
                    callback(null, { stdout: digest1 });
                } else if (command.includes(image2)) {
                    callback(null, { stdout: digest2 });
                } else {
                    throw new Error("Unrecognized skopeo inspect call: " + command)
                }
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        expect(result.commands.outputs.revision).toBeUndefined()

        const digests = JSON.parse(result.commands.outputs.digest)
        expect(digests.length).toBe(2)
        expect(digests[0]).toBe(digest1)
        expect(digests[1]).toBe(digest2)
    })

    test("Multiple images with one unchanged digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: JSON.stringify([image1, image2]), digest: JSON.stringify([digest1, digest2]) })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                if (command.includes(image1)) {
                    callback(null, { stdout: digest1 });
                } else if (command.includes(image2)) {
                    callback(null, { stdout: newDigest2 });
                } else {
                    throw new Error("Unrecognized skopeo inspect call: " + command)
                }
            } else if (command.includes('skopeo list-tags')) {
                if (command.includes('docker://' + image2.split(':')[0])) {
                    callback(null, { stdout: JSON.stringify({ Tags: ['2.0.0'] }) });
                } else {
                    throw new Error("Unrecognized skopeo list-tags call: " + command)
                }
            } else if (command.includes('docker buildx imagetools create')) {
                callback(null, { stdout: '' });
            } else {
                throw new Error("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess).toBeTruthy()
        
        const revisions = JSON.parse(result.commands.outputs.revision)
        expect(revisions.length).toBe(2)
        expect(revisions[0]).toBeNull()
        expect(revisions[1]).toBe(revision2)

        const digests = JSON.parse(result.commands.outputs.digest)
        expect(digests.length).toBe(2)
        expect(digests[0]).toBe(digest1)
        expect(digests[1]).toBe(newDigest2)
    })

})
