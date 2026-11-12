ALTER TABLE "clients" ADD CONSTRAINT "clients_name_check" CHECK ("name" = btrim("name") AND "name" <> '');
ALTER TABLE "clients" ADD CONSTRAINT "clients_phone_check" CHECK ("phone" = btrim("phone") AND "phone" <> '');
ALTER TABLE "units" ADD CONSTRAINT "units_price_max_check" CHECK ("price" <= 100000000000);
