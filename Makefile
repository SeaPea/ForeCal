VERSION=$(shell cat package.json | grep version | grep -o "[0-9][0-9]*\.[0-9][0-9]*")
NAME=$(shell cat package.json | grep '"name":' | head -1 | sed 's/,//g' |sed 's/"//g' | awk '{ print $$2 }')

all: build

build:
	pebble build

config:
	pebble emu-app-config --emulator $(PEBBLE_EMULATOR)

log:
	pebble logs --emulator $(PEBBLE_EMULATOR)

install:
	pebble install --emulator $(PEBBLE_EMULATOR)

clean:
	pebble clean

size:
	pebble analyze-size

logs:
	pebble logs --emulator $(PEBBLE_EMULATOR)

phone-logs:
	pebble logs --phone ${PEBBLE_PHONE}

screenshot:
	pebble screenshot --phone ${PEBBLE_PHONE}

deploy:
	pebble install --phone ${PEBBLE_PHONE}

wipe:
	pebble wipe

DOCKER_IMAGE = ghcr.io/skylord123/docker-coredevices-pebble-tool:latest
DOCKER_RUN = docker run --rm -v $(shell pwd):/pebble \
	--user $(shell id -u):$(shell id -g) \
	-e HOME=/tmp \
	-e PEBBLE_HOME=/opt/pebble-sdk \
	$(DOCKER_IMAGE)

docker-build:
	$(DOCKER_RUN)

docker-clean:
	$(DOCKER_RUN) pebble clean

docker:
	docker run --rm -it -v $(shell pwd):/pebble -e PEBBLE_PHONE $(DOCKER_IMAGE) /bin/bash

.PHONY: all build config log install clean size logs screenshot deploy wipe phone-logs docker-build docker-clean docker
