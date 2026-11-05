/* Blockcraft Battle Ground — optional network configuration.
   Loaded before the game. Leave everything empty to use direct links plus the
   public broker fallback.

   Add a TURN relay so players on strict networks (corporate/school firewalls,
   symmetric NAT, some mobile carriers) still get a fast link instead of the
   broker. Free public TURN no longer exists; pick one:

   A) Metered (free tier, about 20 GB/month): create an app at metered.ca, then
      set `metered` below. The game fetches short-lived credentials per session.
        metered: { domain: 'yourapp.metered.live', apiKey: 'your-api-key' }

   B) Your own coturn server (or any provider with static credentials):
        turn: [
          { urls: ['turn:turn.example.com:3478?transport=udp',
                   'turn:turn.example.com:3478?transport=tcp',
                   'turns:turn.example.com:443?transport=tcp'],
            username: 'user', credential: 'secret' }
        ]
*/
window.BC_NET_CONFIG = {
  metered: null,
  turn: []
};
