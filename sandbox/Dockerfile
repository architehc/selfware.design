FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3t64 libgcc-s1 libstdc++6 libxcb1 libdbus-1-3 \
    libsystemd0 curl git vim-tiny nano \
    cargo rustc \
    && rm -rf /var/lib/apt/lists/*

RUN userdel -r ubuntu 2>/dev/null; useradd -m -u 1000 -s /bin/bash trial

COPY selfware /usr/local/bin/selfware
RUN chmod +x /usr/local/bin/selfware

RUN mkdir -p /home/trial/.config/selfware
COPY selfware.toml /home/trial/.config/selfware/config.toml
RUN chown -R trial:trial /home/trial

COPY welcome.sh /etc/profile.d/welcome.sh
COPY sample-project /home/trial/sample-project
RUN chown -R trial:trial /home/trial/sample-project

ENV SELFWARE_MODE=yolo

USER trial
WORKDIR /workspace

ENTRYPOINT ["sleep", "infinity"]
