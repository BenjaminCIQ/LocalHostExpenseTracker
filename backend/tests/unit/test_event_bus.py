from app.events.bus import Event, EventBus, TransactionClassifiedEvent


def test_publish_delivers_to_subscriber():
    bus = EventBus()
    seen = []

    def handler(evt: Event):
        seen.append(evt.data["x"])

    bus.subscribe("test", handler)
    bus.publish(Event(name="test", data={"x": 1}))
    assert seen == [1]


def test_multiple_subscribers_receive():
    bus = EventBus()
    seen_a = []
    seen_b = []

    def a(evt: Event):
        seen_a.append(evt.name)

    def b(evt: Event):
        seen_b.append(evt.name)

    bus.subscribe("test", a)
    bus.subscribe("test", b)
    bus.publish(Event(name="test", data={}))

    assert seen_a == ["test"]
    assert seen_b == ["test"]


def test_handler_exception_is_caught():
    bus = EventBus()
    seen = []

    def bad(_evt: Event):
        raise RuntimeError("boom")

    def good(_evt: Event):
        seen.append("ok")

    bus.subscribe("test", bad)
    bus.subscribe("test", good)
    bus.publish(Event(name="test", data={}))

    assert seen == ["ok"]


def test_transaction_classified_event_factory_sets_name():
    evt = TransactionClassifiedEvent({"transaction_id": 1})
    assert evt.name == "transaction_classified"
    assert evt.data["transaction_id"] == 1

