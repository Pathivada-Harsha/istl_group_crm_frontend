// src/components/borrowers/SanctionDetail.js
//
// The dedicated "Level 4" sanction page was removed from the normal UI flow —
// it duplicated exactly what Entity Detail already shows once a sanction is
// selected there (Sanction Details / Derived Values / documents / Repayment
// Schedule, all still live in SanctionOverviewPanel.js and reused by
// BorrowerDetail.js). This route is kept only so an old bookmark or link to
// a specific sanction still lands somewhere useful, by redirecting straight
// to that sanction's context on Entity Detail instead of 404ing.

import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

const SanctionDetailRedirect = () => {
  const { id, sanctionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('returnTab') || 'letters';
    navigate(`/lender/borrowers/${id}?tab=${tab}&sanctionId=${sanctionId}`, { replace: true });
  }, [id, sanctionId, navigate, searchParams]);

  return null;
};

export default SanctionDetailRedirect;
