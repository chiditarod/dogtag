FROM ruby:2.7.5-alpine

RUN set -xe \
    && apk add --no-cache \
        libstdc++ \
        libpq-dev \
        sqlite-libs \
        build-base \
        sqlite-dev \
        nodejs

ENV app /app
RUN mkdir $app
WORKDIR $app

ENV BUNDLE_PATH /bundle_cache

COPY . $app

ENTRYPOINT ["/app/script/entrypoint.sh"]
CMD ["bundle", "exec", "rails", "s", "-b", "0.0.0.0"]
