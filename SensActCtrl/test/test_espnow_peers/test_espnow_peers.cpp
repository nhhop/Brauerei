#include <unity.h>

#include "transport/EspNowPeerTable.h"

using SensActCtrl::EspNowPeerTable;
using Mac = EspNowPeerTable::Mac;

static Mac mac(uint8_t last) { return Mac{0x24, 0x6F, 0x28, 0x00, 0x00, last}; }

void test_command_goes_to_sender_of_parent_topic() {
  EspNowPeerTable t;
  const Mac a = mac(1);
  t.learn("sensactctrl/node-a/actuator/pump", a.data());
  Mac out{};
  TEST_ASSERT_TRUE(t.macForPublish("sensactctrl/node-a/actuator/pump/set", out));
  TEST_ASSERT_TRUE(out == a);
}

void test_unknown_parent_has_no_target() {
  EspNowPeerTable t;
  t.learn("sensactctrl/node-a/actuator/pump/meta", mac(1).data());
  Mac out{};
  TEST_ASSERT_FALSE(t.macForPublish("sensactctrl/node-a/actuator/pump/set", out));
  TEST_ASSERT_FALSE(t.macForPublish("noslash", out));
  TEST_ASSERT_FALSE(t.macForPublish("/leading", out));
}

void test_latest_sender_wins() {
  EspNowPeerTable t;
  t.learn("p/d/actuator/x", mac(1).data());
  t.learn("p/d/actuator/x", mac(2).data());  // board swapped, same device id
  Mac out{};
  TEST_ASSERT_TRUE(t.macForPublish("p/d/actuator/x/set", out));
  TEST_ASSERT_TRUE(out == mac(2));
}

void test_peer_lru_eviction() {
  EspNowPeerTable t(2);
  TEST_ASSERT_TRUE(t.usePeer(mac(1)).isNew);
  TEST_ASSERT_TRUE(t.usePeer(mac(2)).isNew);
  TEST_ASSERT_FALSE(t.usePeer(mac(1)).isNew);  // refreshes 1 → 2 is now LRU

  const auto r = t.usePeer(mac(3));
  TEST_ASSERT_TRUE(r.isNew);
  TEST_ASSERT_TRUE(r.evict);
  TEST_ASSERT_TRUE(r.evicted == mac(2));
  TEST_ASSERT_EQUAL(2, t.peerCount());
}

void test_forget_peer_allows_retry() {
  EspNowPeerTable t;
  t.usePeer(mac(1));
  t.forgetPeer(mac(1));
  TEST_ASSERT_EQUAL(0, t.peerCount());
  TEST_ASSERT_TRUE(t.usePeer(mac(1)).isNew);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_command_goes_to_sender_of_parent_topic);
  RUN_TEST(test_unknown_parent_has_no_target);
  RUN_TEST(test_latest_sender_wins);
  RUN_TEST(test_peer_lru_eviction);
  RUN_TEST(test_forget_peer_allows_retry);
  return UNITY_END();
}
