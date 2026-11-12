import type { ClientDto } from "../../../../clients.types";

export type ClientsTableProps = { clients: ClientDto[]; showOwner: boolean; dimmed: boolean };
