FROM archlinux

ARG APP_HOME
ENV APP_HOME="/opt/bot/"

ARG MEMEBOT2_CLIENT_ID
ENV MEMEBOT2_CLIENT_ID=$MEMEBOT2_CLIENT_ID

ARG MEMEBOT2_TOKEN
ENV MEMEBOT2_TOKEN=$MEMEBOT2_TOKEN

# Install dependencies
RUN pacman -Syy --quiet --noconfirm
RUN pacman -S nodejs npm --noconfirm

# Install bot src
RUN mkdir -p ${APP_HOME}
COPY ./build/* ${APP_HOME}

# Fix permissions and ownership
RUN chown -R root:root ${APP_HOME}
RUN chmod -R 755 ${APP_HOME}

# Entrypoint
WORKDIR ${APP_HOME}
RUN npm install
# CMD ["/usr/bin/bash"]
ENTRYPOINT ["node", "main.js"]