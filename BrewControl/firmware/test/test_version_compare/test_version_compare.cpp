#include <unity.h>

#include "VersionCompare.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

void test_release_numbers() {
  TEST_ASSERT_TRUE(isOlderVersion("v0.8.0", "v0.9.0"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.9", "v0.10.0"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.0", "v1.0.0"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.9.0", "v0.8.0"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.8.0", "v0.8.0"));
}

// The case from 2026-10-27: preview install, then a check in the stable channel.
void test_stable_release_is_older_than_a_newer_release_candidate() {
  TEST_ASSERT_TRUE(isOlderVersion("v0.8.0", "v0.9.0-rc.1"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.9.0-rc.1", "v0.8.0"));
}

void test_prerelease_sorts_before_its_release() {
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.0-rc.1", "v0.9.0"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.0-rc.1", "v0.9.0-rc.2"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.0-rc.2", "v0.9.0-rc.10"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.9.0-beta.1", "v0.9.0-rc.1"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.9.0", "v0.9.0-rc.1"));
}

// A local build carries `git describe` output: N commits past the tag.
void test_git_describe_build_is_newer_than_its_tag_only() {
  TEST_ASSERT_TRUE(isOlderVersion("v0.8.0", "v0.8.0-3-gabc1234"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.8.0", "v0.8.0-3-gabc1234-dirty"));
  TEST_ASSERT_TRUE(isOlderVersion("v0.7.0-rc.1", "v0.7.0-rc.1-65-gc1cc712-dirty"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.8.0", "v0.7.0-rc.1-65-gc1cc712-dirty"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.7.0", "v0.7.0-rc.1-65-gc1cc712"));
}

// Nothing to compare: keep offering the release (the behavior before).
void test_unparseable_versions_are_never_older() {
  TEST_ASSERT_FALSE(isOlderVersion("v0.8.0", "c1cc712"));
  TEST_ASSERT_FALSE(isOlderVersion("v0.8.0", "c1cc712-dirty"));
  TEST_ASSERT_FALSE(isOlderVersion("nightly", "v0.9.0"));
  TEST_ASSERT_FALSE(isOlderVersion("", "v0.9.0"));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_release_numbers);
  RUN_TEST(test_stable_release_is_older_than_a_newer_release_candidate);
  RUN_TEST(test_prerelease_sorts_before_its_release);
  RUN_TEST(test_git_describe_build_is_newer_than_its_tag_only);
  RUN_TEST(test_unparseable_versions_are_never_older);
  return UNITY_END();
}
