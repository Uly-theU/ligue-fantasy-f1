FROM alpine:3.20
RUN apk add --no-cache curl
COPY docker/cron-entrypoint.sh /usr/local/bin/cron-entrypoint.sh
COPY docker/cron-job.sh /usr/local/bin/cron-job.sh
COPY docker/crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/cron-entrypoint.sh /usr/local/bin/cron-job.sh
ENV TZ=UTC
CMD ["/usr/local/bin/cron-entrypoint.sh"]
