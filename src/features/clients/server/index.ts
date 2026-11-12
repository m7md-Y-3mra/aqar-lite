import "server-only";

export { listClients, getClient, createClient, updateClient } from "./clients.service";
export {
  listClientsHandler,
  getClientHandler,
  createClientHandler,
  updateClientHandler,
} from "./clients.routes";
