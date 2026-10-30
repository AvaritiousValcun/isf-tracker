import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Label } from './label';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '@/lib/api';

export function QRShareDialog() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ rawToken?: string; token?: string; expiresAt: string } | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const scope = ['readings', 'patch_status', 'profile'];
      const result = await apiRequest<{ token?: string; rawToken?: string; expiresAt: string }>('/share', {
        method: 'POST',
        body: JSON.stringify({ scope, isEmergency }),
      });
      if (result) {
        setTokenInfo(result);
      }
    } catch (err) {
      console.error('QR share error:', err);
    }
    setLoading(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setTokenInfo(null);
      setIsEmergency(false);
    }, 300);
  };

  const activeToken = tokenInfo?.rawToken || tokenInfo?.token;
  const shareUrl = activeToken ? `${window.location.origin}/emergency/${activeToken}` : '';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
          <QrCode className="w-4 h-4" />
          {t('qr.button_generate', 'Generate QR Access')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            {t('qr.title', 'Temporary Provider Access')}
          </DialogTitle>
        </DialogHeader>

        {!tokenInfo ? (
          <div className="space-y-6 py-4">
            <p className="text-sm text-muted-foreground">{t('qr.description', 'Generate a secure 24-hour QR token to grant emergency or clinical providers read-only access to your continuous ISF telemetry.')}</p>
            
            <div className="flex items-start gap-3 bg-destructive/10 p-3 rounded-md border border-destructive/20">
              <Checkbox 
                id="emergency-mode" 
                checked={isEmergency} 
                onCheckedChange={(c) => setIsEmergency(c as boolean)} 
                className="mt-1 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
              />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="emergency-mode" className="text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('qr.emergency_mode', 'Emergency Mode')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('qr.emergency_desc', 'Prioritizes vital hormone telemetry and acute sensor status for rapid triage.')}
                </p>
              </div>
            </div>

            <Button className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading ? t('ui.loading', 'Generating...') : t('qr.action_generate', 'Generate QR Access')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            <div className="p-4 bg-white rounded-lg shadow-sm border">
              <QRCodeSVG value={shareUrl} size={200} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">{t('qr.scan_instruction', 'Present this QR code to your clinical provider')}</p>
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" />
                <span>Expires in 24 hours</span>
              </div>
            </div>
            <div className="w-full space-y-2">
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => navigator.clipboard.writeText(shareUrl)}
              >
                Copy Link
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
