FROM ruby:2.5.0

RUN apt-get update -qq
RUN apt-get install -y build-essential libpq-dev

ENV app /app
RUN mkdir $app
WORKDIR $app

ENV BUNDLE_PATH /bundle_cache

COPY . $app

ENTRYPOINT ["/app/script/entrypoint.sh"]
CMD ["bundle", "exec", "rails", "s", "-b", "0.0.0.0"]
