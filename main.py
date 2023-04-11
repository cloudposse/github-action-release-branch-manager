import re
import logging
import click
import json
import subprocess

# https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
SEMVER_PATTERN = r'^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$'
RELEASE_BRANCH_PREFIX = 'release/v'
RELEASE_BRANCH_PATTERN = r'^release\/v(?P<major>[0-9]+)$'


class ReleaserError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


def main(github_context: str):
    github_obj = deserialize_github_object(github_context)
    logging.debug(f"GitHub object: {github_obj}")

    validate_github_object(github_obj)

    release_tag = get_release_tag(github_obj)
    logging.info(f"Release tag: {release_tag}")

    target_branch = get_target_branch(github_obj)
    logging.info(f"Target branch: {target_branch}")

    major_for_release_tag = get_major(release_tag)
    logging.info(f"Major version for release tag branch: {target_branch}")

    default_branch = get_default_branch(github_obj)
    logging.info(f"Default branch: {default_branch}")

    if target_branch == default_branch:
        if does_major_tag_already_exists(major_for_release_tag):
            logging.info(f"Major tag '{major_for_release_tag}' for '{release_tag}' already exists. All good.")
            return

        previous_commit = get_previous_commit(get_tag_commit(github_obj))
        logging.info(f"Previous commit: {previous_commit}")

        release_branch_name = f'{RELEASE_BRANCH_PREFIX}0' if major_for_release_tag == '' else f'{RELEASE_BRANCH_PREFIX}{major_for_release_tag}'
        logging.info(f"Release branch to create: {release_branch_name}")

        if does_branch_exists(release_branch_name):
            raise ReleaserError(f"Branch '{release_branch_name}' already exists")

        logging.info(f"Creating branch '{release_branch_name}' from commit '{previous_commit}' and pushing it to origin")
        create_branch_from_commit_and_push(release_branch_name, previous_commit)
        logging.info(f"Created branch '{release_branch_name}'")
    elif is_branch_a_release_branch(target_branch):
        major_for_release_branch = get_major_from_release_branch(target_branch)

        if major_for_release_tag == major_for_release_branch:
            logging.info(f"Published release {release_tag} for release branch '{target_branch}'. All good.")
        else:
            raise ReleaserError(f"Major version in release tag '{release_tag}' does not match release branch version '{target_branch}'")
    else:
        raise ReleaserError(f"Target branch '{target_branch}' is not a default or release branch")


def does_branch_exists(branch_name: str) -> bool:
    try:
        subprocess.check_output(['git', 'rev-parse', '--verify', branch_name])
        return True
    except subprocess.CalledProcessError:
        return False


def create_branch_from_commit_and_push(branch_name: str, commit: str):
    subprocess.check_output(['git', 'checkout', '-b', branch_name, commit])
    subprocess.check_output(['git', 'push', 'origin', branch_name])


def get_previous_commit(sha: str) -> str:
    return subprocess.check_output(['git', 'rev-parse', f'{sha}^']).decode('utf-8').strip()


def does_major_tag_already_exists(major: str) -> bool:
    tag_map = build_tag_map(get_all_tags())
    return major in tag_map


def build_tag_map(tags: list) -> dict:
    tag_map = {}

    for tag in tags:
        if not is_semver(tag):
            continue

        major = get_major(tag)
        if major not in tag_map:
            tag_map[major] = []

        tag_map[major].append(tag)

    return tag_map


def is_branch_a_release_branch(branch_name: str) -> bool:
    return re.match(RELEASE_BRANCH_PATTERN, branch_name) is not None


def get_tag_commit(github_object: dict) -> str:
    return str(github_object.get('sha'))


def get_all_tags():
    return subprocess.check_output(['git', 'tag', '-l']).decode('utf-8').splitlines()


def get_default_branch(github_object: dict) -> str:
    return str(github_object.get('event', {}).get('repository', {}).get('default_branch'))


def get_target_branch(github_object: dict) -> str:
    return str(github_object.get('event', {}).get('release', {}).get('target_commitish'))


def get_release_tag(github_object: dict) -> str:
    return str(github_object.get('event', {}).get('release', {}).get('tag_name'))


def validate_github_object(github_object: dict):
    event_name = github_object.get('event_name')
    if event_name != 'release':
        raise ReleaserError(f"Unsupported event '{event_name}'. Only supported event is 'release'.")

    release_tag: str = get_release_tag(github_object)
    if not is_semver(release_tag):
        raise ReleaserError(f"Release tag '{release_tag}' is not in SemVer format")


def deserialize_github_object(github_object: str) -> dict:
    try:
        return json.loads(github_object)
    except json.JSONDecodeError as e:
        raise ReleaserError(f"Error deserializing GitHub object: {e}")


def is_semver(version: str) -> bool:
    return re.match(SEMVER_PATTERN, version) is not None


def get_major_from_release_branch(release_branch: str) -> str:
    match = re.match(RELEASE_BRANCH_PATTERN, release_branch)
    return match.group('major') if match else ''


def get_major(version: str) -> str:
    match = re.match(SEMVER_PATTERN, version)
    return match.group('major') if match else ''


@click.command()
@click.option('--github-context',
              required=True,
              help="Complete GitHub context object serialized as JSON")
@click.option('--log-level',
              default='INFO',
              show_default=True,
              required=True,
              help="Log Level: [CRITICAL|ERROR|WARNING|INFO|DEBUG]")
def cli_main(github_context: str,
             log_level: str):
    logging.basicConfig(format='[%(asctime)s] %(levelname)-7s %(message)s',
                        datefmt='%d-%m-%Y %H:%M:%S',
                        level=logging.getLevelName(log_level))

    try:
        main(github_context)
    except ReleaserError as e:
        logging.error(e)
        exit(1)


if __name__ == "__main__":
    # pylint: disable=no-value-for-parameter
    cli_main()
