import type { ClientDto } from "../../../../clients.types";

export type ClientFormFieldsProps = { mode: "create" } | { mode: "edit"; client: ClientDto };
