'use strict';

const { RunOptions, RunTarget } = require('github-action-ts-run-api');

const child_process = require('child_process')
jest.mock("child_process")
jest.setTimeout(100000)

const runAction = require('../src/action');

describe(`Single image tests`, () => {
    const digest = 'sha256:42'
    const image = 'unknown-image:1.0.0'
    const revision = '1.0.0-001'
    const revisionImage = 'unknown-image:1.0.0-001'
    const revisionImage2 = 'unknown-image:1.0.0-002'

    beforeEach(() => {
        jest.resetModules();
    });

    test("Singe image with no input digest", async () => {
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
                fail("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBeUndefined
        expect(result.commands.outputs.revision).toBe(revision)
    })

    test("Single image with unchanged digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, digest: digest })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://" + image)
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
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
                fail("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(updatedDigest)
        expect(result.commands.outputs.revision).toBe('1.0.0-002')
    })

    test("Single image with os input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, os: 'linux' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-os=linux inspect --format '{{.Digest}}' docker://" + image)
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with arch input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, arch: 'x86' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-arch=x86 inspect --format '{{.Digest}}' docker://" + image)
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with variant input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: image, variant: 'v6' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-variant=v6 inspect --format '{{.Digest}}' docker://" + image)
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

})
