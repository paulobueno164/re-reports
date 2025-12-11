import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify CRON_SECRET for authentication (since verify_jwt is disabled for cron job access)
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (!expectedSecret || providedSecret !== expectedSecret) {
    console.error("Unauthorized access attempt - invalid or missing CRON_SECRET");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }

  try {
    console.log("Starting pending expenses check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find expenses pending for more than 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: pendingExpenses, error: expensesError } = await supabase
      .from("lancamentos")
      .select(`
        id,
        valor_lancado,
        created_at,
        status,
        colaborador_id,
        colaboradores_elegiveis!inner(nome, email, matricula),
        tipos_despesas!inner(nome),
        calendario_periodos!inner(periodo)
      `)
      .in("status", ["enviado", "em_analise"])
      .lt("created_at", threeDaysAgo.toISOString());

    if (expensesError) {
      console.error("Error fetching pending expenses:", expensesError);
      throw expensesError;
    }

    console.log(`Found ${pendingExpenses?.length || 0} pending expenses older than 3 days`);

    if (!pendingExpenses || pendingExpenses.length === 0) {
      return new Response(JSON.stringify({ message: "No pending expenses found", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get RH users to notify
    const { data: rhUsers, error: rhError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "RH");

    if (rhError) {
      console.error("Error fetching RH users:", rhError);
      throw rhError;
    }

    if (!rhUsers || rhUsers.length === 0) {
      console.log("No RH users found to notify");
      return new Response(JSON.stringify({ message: "No RH users to notify", count: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get RH emails from profiles
    const { data: rhProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email, nome")
      .in("id", rhUsers.map(u => u.user_id));

    if (profilesError) {
      console.error("Error fetching RH profiles:", profilesError);
      throw profilesError;
    }

    // Group expenses by period
    const expensesByPeriod: Record<string, any[]> = {};
    for (const expense of pendingExpenses) {
      const calendarioPeriodos = expense.calendario_periodos as any;
      const periodo = calendarioPeriodos?.periodo || "Período desconhecido";
      if (!expensesByPeriod[periodo]) {
        expensesByPeriod[periodo] = [];
      }
      expensesByPeriod[periodo].push(expense);
    }

    // Format email content
    let expenseListHtml = "";
    for (const [periodo, expenses] of Object.entries(expensesByPeriod)) {
      expenseListHtml += `<h3 style="color: #333; margin-top: 20px;">Período: ${periodo}</h3>`;
      expenseListHtml += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Colaborador</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Tipo Despesa</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Valor</th>
            <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Dias Pendente</th>
          </tr>
        </thead>
        <tbody>`;
      
      for (const expense of expenses) {
        const daysAgo = Math.floor((Date.now() - new Date(expense.created_at).getTime()) / (1000 * 60 * 60 * 24));
        expenseListHtml += `
          <tr>
            <td style="border: 1px solid #ddd; padding: 10px;">${expense.colaboradores_elegiveis?.nome} (${expense.colaboradores_elegiveis?.matricula})</td>
            <td style="border: 1px solid #ddd; padding: 10px;">${expense.tipos_despesas?.nome}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">R$ ${expense.valor_lancado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #dc2626; font-weight: bold;">${daysAgo} dias</td>
          </tr>`;
      }
      expenseListHtml += `</tbody></table>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Alerta: Despesas Pendentes</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Alerta: Despesas Pendentes de Validação</h1>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Olá,</p>
          <p>Existem <strong style="color: #dc2626;">${pendingExpenses.length} despesa(s)</strong> aguardando validação há mais de 3 dias no sistema RE-Reports.</p>
          
          ${expenseListHtml}
          
          <div style="margin-top: 30px; padding: 20px; background-color: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e;"><strong>Ação Necessária:</strong> Por favor, acesse o sistema para revisar e validar estas despesas.</p>
          </div>
          
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            Este é um e-mail automático do sistema RE-Reports. Por favor, não responda a este e-mail.
          </p>
        </div>
      </body>
      </html>
    `;

    // Send email to each RH user
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.office365.com",
        port: parseInt(Deno.env.get("SMTP_PORT") || "587"),
        tls: true,
        auth: {
          username: Deno.env.get("SMTP_USER") || "",
          password: Deno.env.get("SMTP_PASS") || "",
        },
      },
    });

    let emailsSent = 0;
    for (const profile of rhProfiles || []) {
      try {
        await client.send({
          from: Deno.env.get("SMTP_USER") || "",
          to: profile.email,
          subject: `[RE-Reports] Alerta: ${pendingExpenses.length} despesa(s) pendente(s) há mais de 3 dias`,
          content: "auto",
          html: htmlContent,
        });
        console.log(`Email sent to ${profile.email}`);
        emailsSent++;
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
      }
    }

    await client.close();

    console.log(`Process completed. Sent ${emailsSent} emails for ${pendingExpenses.length} pending expenses.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pendingExpenses: pendingExpenses.length,
        emailsSent 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-pending-expenses:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
