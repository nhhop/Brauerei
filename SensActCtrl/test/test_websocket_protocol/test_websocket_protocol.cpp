#include <unity.h>

#include <string>

#include "transport/WebSocketProtocol.h"

using SensActCtrl::websocket::decodeFrame;
using SensActCtrl::websocket::encodeData;
using SensActCtrl::websocket::Frame;
using SensActCtrl::websocket::FrameType;
using SensActCtrl::websocket::parseUrl;
using SensActCtrl::websocket::Url;

static Frame decode(const std::string& s) { return decodeFrame(s.data(), s.size()); }

void test_data_round_trip() {
  const std::string wire = encodeData("sensactctrl/leaf/sensor/t1", "{\"v\":21.5}");
  TEST_ASSERT_EQUAL_STRING("Dsensactctrl/leaf/sensor/t1\n{\"v\":21.5}", wire.c_str());

  const Frame f = decode(wire);
  TEST_ASSERT_TRUE(f.type == FrameType::Data);
  TEST_ASSERT_EQUAL_STRING("sensactctrl/leaf/sensor/t1", f.topic.c_str());
  TEST_ASSERT_EQUAL_STRING("{\"v\":21.5}", f.payload.c_str());
}

void test_payload_may_contain_newlines() {
  const Frame f = decode(encodeData("a/b", "line1\nline2\n"));
  TEST_ASSERT_TRUE(f.type == FrameType::Data);
  TEST_ASSERT_EQUAL_STRING("a/b", f.topic.c_str());
  TEST_ASSERT_EQUAL_STRING("line1\nline2\n", f.payload.c_str());
}

void test_empty_payload() {
  const Frame f = decode(encodeData("a/b", ""));
  TEST_ASSERT_TRUE(f.type == FrameType::Data);
  TEST_ASSERT_EQUAL_STRING("a/b", f.topic.c_str());
  TEST_ASSERT_EQUAL_UINT32(0, f.payload.size());
}

void test_null_payload_encodes_as_empty() {
  TEST_ASSERT_EQUAL_STRING("Da/b\n", encodeData("a/b", nullptr).c_str());
}

void test_unframeable_topic_encodes_empty() {
  TEST_ASSERT_TRUE(encodeData("", "x").empty());
  TEST_ASSERT_TRUE(encodeData(nullptr, "x").empty());
  TEST_ASSERT_TRUE(encodeData("a\nb", "x").empty());
}

void test_retained_request() {
  TEST_ASSERT_TRUE(decode("R").type == FrameType::RetainedRequest);
}

void test_invalid_frames() {
  TEST_ASSERT_TRUE(decodeFrame(nullptr, 0).type == FrameType::Invalid);
  TEST_ASSERT_TRUE(decode("").type == FrameType::Invalid);
  TEST_ASSERT_TRUE(decode("Xa/b\npayload").type == FrameType::Invalid);  // unknown type
  TEST_ASSERT_TRUE(decode("Da/b").type == FrameType::Invalid);           // no separator
  TEST_ASSERT_TRUE(decode("D\npayload").type == FrameType::Invalid);     // empty topic
  TEST_ASSERT_TRUE(decode("D").type == FrameType::Invalid);
  TEST_ASSERT_TRUE(decode("Rx").type == FrameType::Invalid);             // trailing bytes
}

void test_decode_respects_length_not_nul() {
  // Frames arrive as (pointer, length) — a separator past `length` must not count.
  const char buf[] = "Da/b\npayload";
  TEST_ASSERT_TRUE(decodeFrame(buf, 4).type == FrameType::Invalid);
  const Frame f = decodeFrame(buf, 8);
  TEST_ASSERT_TRUE(f.type == FrameType::Data);
  TEST_ASSERT_EQUAL_STRING("pay", f.payload.c_str());
}

void test_url_host_only() {
  Url u;
  TEST_ASSERT_TRUE(parseUrl("ws://192.168.1.50", u));
  TEST_ASSERT_EQUAL_STRING("192.168.1.50", u.host.c_str());
  TEST_ASSERT_EQUAL_UINT16(80, u.port);
  TEST_ASSERT_EQUAL_STRING("/", u.path.c_str());
}

void test_url_with_port_and_path() {
  Url u;
  TEST_ASSERT_TRUE(parseUrl("ws://brewcontrol.local:8081/remote", u));
  TEST_ASSERT_EQUAL_STRING("brewcontrol.local", u.host.c_str());
  TEST_ASSERT_EQUAL_UINT16(8081, u.port);
  TEST_ASSERT_EQUAL_STRING("/remote", u.path.c_str());
}

void test_url_with_port_trailing_slash() {
  Url u;
  TEST_ASSERT_TRUE(parseUrl("ws://10.0.0.2:81/", u));
  TEST_ASSERT_EQUAL_STRING("10.0.0.2", u.host.c_str());
  TEST_ASSERT_EQUAL_UINT16(81, u.port);
  TEST_ASSERT_EQUAL_STRING("/", u.path.c_str());
}

void test_url_rejects_invalid() {
  Url u;
  TEST_ASSERT_FALSE(parseUrl(nullptr, u));
  TEST_ASSERT_FALSE(parseUrl("", u));
  TEST_ASSERT_FALSE(parseUrl("wss://host:8081", u));
  TEST_ASSERT_FALSE(parseUrl("http://host:8081", u));
  TEST_ASSERT_FALSE(parseUrl("ws://", u));
  TEST_ASSERT_FALSE(parseUrl("ws://:8081", u));
  TEST_ASSERT_FALSE(parseUrl("ws://host:", u));
  TEST_ASSERT_FALSE(parseUrl("ws://host:0", u));
  TEST_ASSERT_FALSE(parseUrl("ws://host:65536", u));
  TEST_ASSERT_FALSE(parseUrl("ws://host:80x", u));
}

void test_url_failure_leaves_output_untouched() {
  Url u;
  u.host = "keep";
  TEST_ASSERT_FALSE(parseUrl("ws://host:99999", u));
  TEST_ASSERT_EQUAL_STRING("keep", u.host.c_str());
}

void test_device_of_topic() {
  using SensActCtrl::websocket::deviceOfTopic;
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("sensactctrl/leaf/sensor/t1").c_str());
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("sensactctrl/leaf/actuator/h1/set").c_str());
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("sensactctrl/leaf/controller/c1/tune").c_str());
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("sensactctrl/leaf/sensor/t1/ch/meta").c_str());
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("leaf/actuator/h1/set").c_str());  // empty prefix
  TEST_ASSERT_EQUAL_STRING("leaf", deviceOfTopic("a/b/leaf/sensor/t1").c_str());    // multi-segment prefix
  TEST_ASSERT_TRUE(deviceOfTopic("a/b").empty());
  TEST_ASSERT_TRUE(deviceOfTopic("").empty());
}

void test_is_command_topic() {
  using SensActCtrl::websocket::isCommandTopic;
  TEST_ASSERT_TRUE(isCommandTopic("sensactctrl/leaf/actuator/h1/set"));
  TEST_ASSERT_TRUE(isCommandTopic("sensactctrl/leaf/controller/c1/tune"));
  TEST_ASSERT_FALSE(isCommandTopic("sensactctrl/leaf/actuator/h1"));
  TEST_ASSERT_FALSE(isCommandTopic("sensactctrl/leaf/actuator/h1/meta"));
  TEST_ASSERT_FALSE(isCommandTopic("set"));
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_data_round_trip);
  RUN_TEST(test_payload_may_contain_newlines);
  RUN_TEST(test_empty_payload);
  RUN_TEST(test_null_payload_encodes_as_empty);
  RUN_TEST(test_unframeable_topic_encodes_empty);
  RUN_TEST(test_retained_request);
  RUN_TEST(test_invalid_frames);
  RUN_TEST(test_decode_respects_length_not_nul);
  RUN_TEST(test_url_host_only);
  RUN_TEST(test_url_with_port_and_path);
  RUN_TEST(test_url_with_port_trailing_slash);
  RUN_TEST(test_url_rejects_invalid);
  RUN_TEST(test_url_failure_leaves_output_untouched);
  RUN_TEST(test_device_of_topic);
  RUN_TEST(test_is_command_topic);
  return UNITY_END();
}
